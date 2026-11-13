package br.com.protecextintores.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** The immutable outbox survives WebView/app shutdown. Server receipts make retries idempotent. */
public final class OfflineSyncWorker extends Worker {
    public OfflineSyncWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);}
    public static void schedule(Context context,String account) throws Exception {
        if(!account.matches("(employee|seller):[a-zA-Z0-9_-]{1,100}"))throw new IllegalArgumentException("Conta inválida.");
        WorkManager manager=WorkManager.getInstance(context);String name="protec-sync:"+account;
        for(WorkInfo work:manager.getWorkInfosForUniqueWork(name).get())if(work.getState()==WorkInfo.State.ENQUEUED||work.getState()==WorkInfo.State.BLOCKED)return;
        OneTimeWorkRequest request=new OneTimeWorkRequest.Builder(OfflineSyncWorker.class)
                .addTag("protec-offline-sync")
                .setInputData(new Data.Builder().putString("account",account).build())
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build();
        manager.enqueueUniqueWork(name,ExistingWorkPolicy.APPEND_OR_REPLACE,request);
    }
    @NonNull @Override public Result doWork(){
        String account=getInputData().getString("account");if(account==null)return Result.failure();
        OfflineVault vault=OfflineVault.get(getApplicationContext());
        try{
            JSONObject auth=vault.object("auth:"+account);if(auth==null||auth.optString("token").isEmpty())return Result.success();
            JSONArray keys=vault.keys("op:"+account+":");List<JSONObject> operations=new ArrayList<>();
            for(int i=0;i<keys.length();i++){JSONObject op=vault.object(keys.getString(i));if(op!=null)operations.add(op);}
            Collections.sort(operations,(a,b)->a.optString("createdAt").compareTo(b.optString("createdAt")));Set<String> blocked=new HashSet<>();
            long began=System.currentTimeMillis();
            for(JSONObject op:operations){
                if(isStopped())return Result.retry();if(System.currentTimeMillis()-began>7*60*1000)return Result.retry();
                if(vault.object("auth:"+account)==null)return Result.success();
                String resultKey="result:"+account+":"+op.getString("id"),serviceId=op.getString("serviceId");JSONObject old=vault.object(resultKey);
                if(old!=null&&(old.optBoolean("ok")||old.optBoolean("discarded")))continue;
                if(blocked.contains(serviceId)||(old!=null&&old.optBoolean("conflict"))){blocked.add(serviceId);continue;}
                vault.put("sync-state:"+account,new JSONObject().put("syncing",true).put("kind",op.optString("kind")).put("serviceId",serviceId).put("at",System.currentTimeMillis()));
                Reply reply=send(op,auth.getString("token"),vault,account);
                if(reply.code==401||reply.code==403&&!reply.data.optBoolean("conflict")){vault.put("sync-state:"+account,new JSONObject().put("needsLogin",true).put("message",reply.data.optString("error")));return Result.success();}
                if(reply.code>=200&&reply.code<300){
                    vault.put(resultKey,reply.data);
                    if(reply.data.has("serverAt"))vault.put("last-sync:"+account,new JSONObject().put("at",reply.data.getString("serverAt")));
                    if(op.optString("kind").equals("media"))vault.remove(op.getJSONObject("payload").getString("blobKey"));
                }else if(reply.data.optBoolean("conflict")||reply.code==400||reply.code==404){
                    reply.data.put("conflict",true);vault.put(resultKey,reply.data);blocked.add(serviceId);
                }else {vault.put("sync-state:"+account,new JSONObject().put("syncing",false).put("retry",true));return Result.retry();}
            }
            vault.put("sync-state:"+account,new JSONObject().put("needsLogin",false));return Result.success();
        }catch(Exception error){try{vault.put("sync-state:"+account,new JSONObject().put("syncing",false).put("retry",true).put("message","Envio interrompido. Os registros continuam neste aparelho."));}catch(Exception ignored){}return Result.retry();}
    }
    private static final class Reply {final int code;final JSONObject data;Reply(int code,JSONObject data){this.code=code;this.data=data;}}
    private Reply send(JSONObject op,String token,OfflineVault vault,String account) throws Exception {
        boolean media=op.getString("kind").equals("media");
        String base=getApplicationContext().getString(R.string.api_base_url);
        URL url=new URL(base+(media?"/api/offline/media":"/api/offline/sync"));
        if(!url.getProtocol().equals("https"))throw new IOException("Conexão segura obrigatória.");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(20000);connection.setReadTimeout(180000);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Authorization","Bearer "+token);connection.setChunkedStreamingMode(65536);
        try{
            String boundary="Protec"+UUID.randomUUID().toString().replace("-","");
            connection.setRequestProperty("Content-Type",media?"multipart/form-data; boundary="+boundary:"application/json; charset=utf-8");
            try(OutputStream out=connection.getOutputStream()){
                if(media){
                    JSONObject payload=op.getJSONObject("payload");
                    write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\"operation\"\r\n\r\n"+op+"\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"video.mp4\"\r\nContent-Type: "+payload.getString("mime")+"\r\n\r\n");
                    long sent=0,total=payload.optLong("size",0),updated=0;
                    try(InputStream input=vault.openBlob(payload.getString("blobKey"))){
                        byte[] buffer=new byte[65536];int count;
                        while((count=input.read(buffer))!=-1){
                            if(isStopped())throw new IOException("Envio interrompido.");out.write(buffer,0,count);sent+=count;
                            long at=System.currentTimeMillis();
                            if(at-updated>=500||sent==total){
                                updated=at;
                                try{vault.put("sync-state:"+account,new JSONObject().put("syncing",true).put("kind","media").put("serviceId",op.getString("serviceId")).put("loaded",sent).put("total",total).put("at",at));}catch(Exception ignored){}
                            }
                        }
                    }
                    write(out,"\r\n--"+boundary+"--\r\n");
                }
                else write(out,op.toString());
            }
            int code=connection.getResponseCode();InputStream input=code>=400?connection.getErrorStream():connection.getInputStream();
            if(input==null)throw new IOException("Sem resposta do servidor.");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream stream=input){byte[] buffer=new byte[8192];int count;while((count=stream.read(buffer))!=-1){if(bytes.size()+count>2*1024*1024)throw new IOException("Resposta muito grande.");bytes.write(buffer,0,count);}}
            return new Reply(code,new JSONObject(bytes.toString("UTF-8")));
        }finally{connection.disconnect();}
    }
    private void write(OutputStream out,String text) throws IOException {out.write(text.getBytes(StandardCharsets.UTF_8));}
}
