package br.com.protecextintores.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.*;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;
import androidx.webkit.*;
import androidx.work.WorkManager;
import org.json.*;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.*;

/** Origin-scoped, main-frame-only bridge. Never install a global JavascriptInterface. */
public final class OfflineBridge {
    private static final int UNLOCK=7215;
    private final Activity activity;private final WebView webView;private final OfflineVault vault;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final Map<String,OfflineVault.BlobWriter> writers=new HashMap<>();
    private final Map<String,InputStream> readers=new HashMap<>();
    private interface UnlockCallback { void accept(boolean ok); }
    private final List<UnlockCallback> unlockWaiters=new ArrayList<>();
    private volatile boolean locked;private boolean prompting,skipNextResume;private long stoppedAt;
    private final android.content.SharedPreferences preferences;
    private final String host,path;
    public OfflineBridge(Activity activity,WebView webView){
        this.activity=activity;this.webView=webView;vault=OfflineVault.get(activity);
        preferences=activity.getSharedPreferences("protec-offline-lock",Context.MODE_PRIVATE);locked=preferences.getBoolean("enabled",false);
        Uri site=Uri.parse(activity.getString(R.string.start_url));host=site.getHost();path=site.getPath();
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(webView,"ProtecNative",Collections.singleton("https://"+host),(view,message,origin,mainFrame,reply)->{
                Uri current=Uri.parse(view.getUrl()==null?"":view.getUrl());
                if(!mainFrame||!"https".equals(origin.getScheme())||!host.equals(origin.getHost())||origin.getPort()!=-1||!"https".equals(current.getScheme())||!host.equals(current.getHost())||current.getPath()==null||!current.getPath().startsWith(path))return;
                try{JSONObject request=new JSONObject(message.getData());String action=request.getString("action"),id=request.getString("id");
                    if(action.equals("unlock")||action.equals("enableLock")||action.equals("disableLock")){
                        requestUnlock(ok->{try{if(!ok)throw new SecurityException("Desbloqueio cancelado.");if(action.equals("enableLock"))preferences.edit().putBoolean("enabled",true).apply();if(action.equals("disableLock"))preferences.edit().putBoolean("enabled",false).apply();respond(reply,id,true,null);}catch(Exception error){respond(reply,id,null,error.getMessage());}});return;
                    }
                    executor.execute(()->{try{respond(reply,id,dispatch(action,request),null);}catch(Exception error){respond(reply,id,null,error.getMessage()==null?"Falha no armazenamento do aparelho.":error.getMessage());}});
                }catch(Exception ignored){/* Malformed/untrusted messages are ignored. */}
            });
        }
    }
    private Object dispatch(String action,JSONObject request) throws Exception {
        if(action.equals("lockState"))return new JSONObject().put("locked",locked).put("enabled",preferences.getBoolean("enabled",false));
        if(action.equals("theme")){String mode=request.getString("mode");if(!mode.equals("light")&&!mode.equals("dark"))throw new IllegalArgumentException("Tema inválido.");activity.runOnUiThread(()->((MainActivity)activity).applyAppearance(mode));return true;}
        if(action.equals("logout")){JSONArray keys=vault.keys("auth:");for(int i=0;i<keys.length();i++)vault.remove(keys.getString(i));vault.put("active",JSONObject.NULL);WorkManager.getInstance(activity).cancelAllWorkByTag("protec-offline-sync");return true;}
        if(locked)throw new SecurityException("Desbloqueie o aparelho para acessar seus registros.");
        String key=request.optString("key");if(key.length()>240)throw new IllegalArgumentException("Chave inválida.");
        switch(action){
            case "get":return vault.read(key);
            case "put":vault.put(key,request.opt("value"));return true;
            case "remove":vault.remove(key);return true;
            case "keys":return vault.keys(request.getString("prefix"));
            case "batch":vault.batch(request.getJSONArray("entries"));return true;
            case "sync":OfflineSyncWorker.schedule(activity,request.getString("accountKey"));return true;
            case "stopSync":WorkManager.getInstance(activity).cancelUniqueWork("protec-sync:"+request.getString("accountKey"));return true;
            case "blobBegin":{String handle=UUID.randomUUID().toString();writers.put(handle,vault.beginBlob(key,request.getLong("size")));return handle;}
            case "blobChunk":{OfflineVault.BlobWriter writer=writers.get(request.getString("handle"));if(writer==null)throw new IllegalStateException("Envio local expirou.");String data=request.getString("data");if(data.length()>180000)throw new IllegalArgumentException("Bloco muito grande.");writer.append(Base64.decode(data,Base64.NO_WRAP));return true;}
            case "blobEnd":{OfflineVault.BlobWriter writer=writers.remove(request.getString("handle"));if(writer==null)throw new IllegalStateException("Envio local expirou.");try{writer.finish();}catch(Exception error){writer.abort();throw error;}return true;}
            case "blobAbort":{OfflineVault.BlobWriter writer=writers.remove(request.getString("handle"));if(writer!=null)writer.abort();return true;}
            case "blobOpen":{String handle=UUID.randomUUID().toString();readers.put(handle,vault.openBlob(key));return handle;}
            case "blobRead":{InputStream reader=readers.get(request.getString("handle"));if(reader==null)throw new IllegalStateException("Leitura local expirou.");byte[] bytes=new byte[131072];int count=reader.read(bytes);return count<0?"":Base64.encodeToString(bytes,0,count,Base64.NO_WRAP);}
            case "blobClose":{InputStream reader=readers.remove(request.getString("handle"));if(reader!=null)reader.close();return true;}
            default:throw new IllegalArgumentException("Recurso nativo desconhecido.");
        }
    }
    private void respond(JavaScriptReplyProxy proxy,String id,Object value,String error){
        activity.runOnUiThread(()->{try{JSONObject message=new JSONObject().put("id",id);if(error!=null)message.put("error",error);else message.put("value",value==null?JSONObject.NULL:value);proxy.postMessage(message.toString());}catch(Exception ignored){}});
    }
    private void requestUnlock(UnlockCallback callback){
        activity.runOnUiThread(()->{
            KeyguardManager manager=(KeyguardManager)activity.getSystemService(Context.KEYGUARD_SERVICE);
            if(manager==null||!manager.isDeviceSecure()){callback.accept(false);android.widget.Toast.makeText(activity,"Configure um bloqueio de tela no Android antes de ativar este recurso.",android.widget.Toast.LENGTH_LONG).show();return;}
            unlockWaiters.add(callback);if(prompting)return;prompting=true;
            Intent intent=manager.createConfirmDeviceCredentialIntent("ProtecExtintores","Desbloqueie para consultar seus serviços.");
            if(intent==null){completeUnlock(false);return;}activity.startActivityForResult(intent,UNLOCK);
        });
    }
    public boolean activityResult(int requestCode,int resultCode){if(requestCode!=UNLOCK)return false;completeUnlock(resultCode==Activity.RESULT_OK);return true;}
    private void completeUnlock(boolean ok){prompting=false;stoppedAt=0;skipNextResume=true;locked=!ok&&preferences.getBoolean("enabled",false);if(ok)event("protec-native-unlock");List<UnlockCallback> callbacks=new ArrayList<>(unlockWaiters);unlockWaiters.clear();for(UnlockCallback c:callbacks)c.accept(ok);}
    private void event(String name){webView.evaluateJavascript("window.dispatchEvent(new Event("+JSONObject.quote(name)+"))",null);}
    public void onStop(){if(!prompting)stoppedAt=System.currentTimeMillis();}
    public void onResume(){if(skipNextResume){skipNextResume=false;return;}if(prompting)return;if(preferences.getBoolean("enabled",false)&&(locked||stoppedAt>0&&System.currentTimeMillis()-stoppedAt>60000)){locked=true;event("protec-native-lock");requestUnlock(ok->{if(!ok)event("protec-native-lock");});}}
    public void destroy(){executor.execute(()->{for(OfflineVault.BlobWriter w:writers.values())w.abort();for(InputStream in:readers.values())try{in.close();}catch(Exception ignored){}writers.clear();readers.clear();});executor.shutdown();}
}
