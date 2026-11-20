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
    private static final int UNLOCK=7215,EXPORT_BACKUP=7216;
    private JavaScriptReplyProxy exportReply;private String exportRequestId,exportKey;
    private final Activity activity;private final WebView webView;private final OfflineVault vault;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final Map<String,OfflineVault.BlobWriter> writers=new HashMap<>();
    private final Map<String,InputStream> readers=new HashMap<>();
    private final Map<String,BackupWriter> backupWriters=new ConcurrentHashMap<>();
    private final Map<String,java.io.File> exportFiles=new ConcurrentHashMap<>();
    // Bytes received here already have password-based AES-GCM protection per frame.
    // Do not wrap a large archive in a second whole-file GCM decrypting stream.
    private final class BackupWriter {
        final String key;final long size;long written;boolean finished;
        final java.io.File file;final java.io.OutputStream out;
        BackupWriter(String key,long size) throws Exception {
            if(!key.startsWith("backup-export:")||size<1||size>10L*1024*1024*1024)throw new java.io.IOException("Tamanho de backup inválido.");
            if(activity.getCacheDir().getUsableSpace()<size+16L*1024*1024)throw new java.io.IOException("Espaço insuficiente para preparar o backup.");
            this.key=key;this.size=size;file=java.io.File.createTempFile("protec-backup-",".encrypted",activity.getCacheDir());out=new java.io.FileOutputStream(file);
        }
        void append(byte[] bytes) throws Exception {if(finished||written+bytes.length>size)throw new java.io.IOException("Bloco de backup inválido.");out.write(bytes);written+=bytes.length;}
        void finish() throws Exception {if(finished)throw new java.io.IOException("Backup já finalizado.");out.close();if(written!=size)throw new java.io.IOException("O backup não foi recebido por inteiro.");finished=true;exportFiles.put(key,file);}
        void abort(){try{out.close();}catch(Exception ignored){}exportFiles.remove(key);file.delete();}
    }
    private void clearBackup(String key){for(Map.Entry<String,BackupWriter> entry:backupWriters.entrySet())if(entry.getValue().key.equals(key)){entry.getValue().abort();backupWriters.remove(entry.getKey());}}

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
                    if(action.equals("exportBlob")){
                        try{
                        if(locked)throw new SecurityException("Desbloqueie o aparelho.");
                        String exportBlobKey=request.getString("key"),filename=request.getString("filename");
                        if(!exportBlobKey.startsWith("backup-export:")||!filename.matches("[A-Za-z0-9._-]+\\.protecbackup"))throw new IllegalArgumentException("Arquivo de backup inválido.");
                        if(exportReply!=null)throw new IllegalStateException("Conclua o salvamento anterior.");
                        if(!exportFiles.containsKey(exportBlobKey))throw new IllegalStateException("O arquivo de backup ainda não foi concluído.");
                        exportReply=reply;exportRequestId=id;exportKey=exportBlobKey;
                        Intent choose=new Intent(Intent.ACTION_CREATE_DOCUMENT);choose.addCategory(Intent.CATEGORY_OPENABLE);choose.setType("application/octet-stream");choose.putExtra(Intent.EXTRA_TITLE,filename);
                        activity.startActivityForResult(choose,EXPORT_BACKUP);
                        }catch(Exception error){exportReply=null;exportRequestId=null;exportKey=null;respond(reply,id,null,error.getMessage());}return;
                    }
                    executor.execute(()->{try{respond(reply,id,dispatch(action,request),null);}catch(Exception error){respond(reply,id,null,error.getMessage()==null?"Falha no armazenamento do aparelho.":error.getMessage());}});
                }catch(Exception ignored){/* Malformed/untrusted messages are ignored. */}
            });
        }
    }
    private Object dispatch(String action,JSONObject request) throws Exception {
        if(action.equals("lockState"))return new JSONObject().put("locked",locked).put("enabled",preferences.getBoolean("enabled",false)).put("backupExport",true);
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
            case "backupBegin":{String handle=UUID.randomUUID().toString();backupWriters.put(handle,new BackupWriter(key,request.getLong("size")));return handle;}
            case "blobBegin":{String handle=UUID.randomUUID().toString();writers.put(handle,vault.beginBlob(key,request.getLong("size")));return handle;}
            case "blobChunk":{BackupWriter backup=backupWriters.get(request.getString("handle"));if(backup!=null){String data=request.getString("data");if(data.length()>180000)throw new IllegalArgumentException("Bloco muito grande.");backup.append(Base64.decode(data,Base64.NO_WRAP));return true;}OfflineVault.BlobWriter writer=writers.get(request.getString("handle"));if(writer==null)throw new IllegalStateException("Envio local expirou.");String data=request.getString("data");if(data.length()>180000)throw new IllegalArgumentException("Bloco muito grande.");writer.append(Base64.decode(data,Base64.NO_WRAP));return true;}
            case "blobEnd":{BackupWriter backup=backupWriters.get(request.getString("handle"));if(backup!=null){try{backup.finish();}catch(Exception error){backup.abort();backupWriters.remove(request.getString("handle"));throw error;}return true;}OfflineVault.BlobWriter writer=writers.remove(request.getString("handle"));if(writer==null)throw new IllegalStateException("Envio local expirou.");try{writer.finish();}catch(Exception error){writer.abort();throw error;}return true;}
            case "blobAbort":{BackupWriter backup=backupWriters.remove(request.getString("handle"));if(backup!=null){backup.abort();return true;}OfflineVault.BlobWriter writer=writers.remove(request.getString("handle"));if(writer!=null)writer.abort();return true;}
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
    public boolean activityResult(int requestCode,int resultCode,Intent data){
        if(requestCode==EXPORT_BACKUP){
            final JavaScriptReplyProxy reply=exportReply;final String id=exportRequestId,key=exportKey;
            exportReply=null;exportRequestId=null;exportKey=null;
            if(reply==null)return true;
            if(resultCode!=Activity.RESULT_OK||data==null||data.getData()==null){executor.execute(()->clearBackup(key));respond(reply,id,null,"Salvamento do backup cancelado.");return true;}
            final Uri destination=data.getData();executor.execute(()->{
                try(InputStream in=new java.io.FileInputStream(exportFiles.get(key));java.io.OutputStream out=activity.getContentResolver().openOutputStream(destination,"w")){
                    if(out==null)throw new java.io.IOException("Não foi possível abrir o destino do backup.");
                    byte[] buffer=new byte[131072];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);out.flush();respond(reply,id,true,null);
                }catch(Exception error){respond(reply,id,null,"Não foi possível salvar o backup: "+error.getMessage());}finally{clearBackup(key);}
            });return true;
        }
        if(requestCode!=UNLOCK)return false;completeUnlock(resultCode==Activity.RESULT_OK);return true;
    }
    private void completeUnlock(boolean ok){prompting=false;stoppedAt=0;skipNextResume=true;locked=!ok&&preferences.getBoolean("enabled",false);if(ok)event("protec-native-unlock");List<UnlockCallback> callbacks=new ArrayList<>(unlockWaiters);unlockWaiters.clear();for(UnlockCallback c:callbacks)c.accept(ok);}
    private void event(String name){webView.evaluateJavascript("window.dispatchEvent(new Event("+JSONObject.quote(name)+"))",null);}
    public void onStop(){if(!prompting)stoppedAt=System.currentTimeMillis();}
    public void onResume(){if(skipNextResume){skipNextResume=false;return;}if(prompting)return;if(preferences.getBoolean("enabled",false)&&(locked||stoppedAt>0&&System.currentTimeMillis()-stoppedAt>60000)){locked=true;event("protec-native-lock");requestUnlock(ok->{if(!ok)event("protec-native-lock");});}}
    public void destroy(){executor.execute(()->{for(BackupWriter w:backupWriters.values())w.abort();backupWriters.clear();exportFiles.clear();for(OfflineVault.BlobWriter w:writers.values())w.abort();for(InputStream in:readers.values())try{in.close();}catch(Exception ignored){}writers.clear();readers.clear();});executor.shutdown();}
}
