package br.com.protecextintores.app;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** Private SQLite records and media, encrypted with a non-exportable Android Keystore key. */
public final class OfflineVault extends SQLiteOpenHelper {
    private static OfflineVault instance;
    private final File mediaDirectory;
    public static synchronized OfflineVault get(Context context) {
        if (instance == null) instance = new OfflineVault(context.getApplicationContext());
        return instance;
    }
    private OfflineVault(Context context) {
        super(context, "protec-offline.db", null, 1);
        setWriteAheadLoggingEnabled(true);
        mediaDirectory = new File(context.getFilesDir(), "offline-media");
        if (!mediaDirectory.isDirectory() && !mediaDirectory.mkdirs()) throw new IllegalStateException("Não foi possível criar o armazenamento de vídeos.");
    }
    @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE vault (key TEXT PRIMARY KEY, value BLOB NOT NULL)"); }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { /* Never drop pending work. */ }
    private static synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        String alias = "ProtecOfflineVaultV1";
        if (!store.containsAlias(alias)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(alias, null);
    }
    private Cipher encryption() throws Exception { Cipher c=Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE,key()); return c; }
    private Cipher decryption(byte[] iv) throws Exception { Cipher c=Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv)); return c; }
    private byte[] encode(Object value) throws Exception {
        Cipher c=encryption();byte[] bytes=String.valueOf(value == null ? JSONObject.NULL : value).getBytes(StandardCharsets.UTF_8);
        // Primitive JSON strings need quotes; objects/arrays already serialize as JSON.
        if(value instanceof String)bytes=JSONObject.quote((String)value).getBytes(StandardCharsets.UTF_8);
        byte[] encrypted=c.doFinal(bytes),iv=c.getIV(),out=new byte[1+iv.length+encrypted.length];out[0]=(byte)iv.length;
        System.arraycopy(iv,0,out,1,iv.length);System.arraycopy(encrypted,0,out,1+iv.length,encrypted.length);return out;
    }
    private Object decode(byte[] bytes) throws Exception {
        int n=bytes[0]&255;if(n!=12||bytes.length<29)throw new IOException("Registro local inválido.");
        byte[] iv=java.util.Arrays.copyOfRange(bytes,1,1+n),data=java.util.Arrays.copyOfRange(bytes,1+n,bytes.length);
        return new JSONTokener(new String(decryption(iv).doFinal(data),StandardCharsets.UTF_8)).nextValue();
    }
    public Object read(String key) throws Exception { try(Cursor c=getReadableDatabase().rawQuery("SELECT value FROM vault WHERE key=?",new String[]{key})){return c.moveToFirst()?decode(c.getBlob(0)):JSONObject.NULL;} }
    public JSONObject object(String key) throws Exception { Object v=read(key);return v instanceof JSONObject?(JSONObject)v:null; }
    public void put(String key,Object value) throws Exception { byte[] data=encode(value);getWritableDatabase().execSQL("INSERT OR REPLACE INTO vault(key,value) VALUES(?,?)",new Object[]{key,data}); }
    public void batch(JSONArray entries) throws Exception {
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try{for(int i=0;i<entries.length();i++){JSONObject entry=entries.getJSONObject(i);put(entry.getString("key"),entry.opt("value"));}db.setTransactionSuccessful();}finally{db.endTransaction();}
    }
    public JSONArray keys(String prefix) { JSONArray rows=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT key FROM vault ORDER BY key",null)){while(c.moveToNext()){String k=c.getString(0);if(k.startsWith(prefix))rows.put(k);}}return rows; }
    public void remove(String key) throws Exception { JSONObject value=object(key);getWritableDatabase().delete("vault","key=?",new String[]{key});if(value!=null&&value.optBoolean("_blob"))blobFile(key).delete(); }
    private File blobFile(String key) throws Exception { byte[] hash=MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));StringBuilder name=new StringBuilder();for(byte b:hash)name.append(String.format("%02x",b&255));return new File(mediaDirectory,name+".enc"); }
    public BlobWriter beginBlob(String key,long size) throws Exception {
        if(size<1||size>50L*1024*1024)throw new IOException("Vídeo acima do limite de 50 MB.");
        if(mediaDirectory.getUsableSpace()<size+8L*1024*1024)throw new IOException("Espaço insuficiente para guardar o vídeo.");
        return new BlobWriter(key,size);
    }
    public final class BlobWriter {
        private final String key;private final long size;private long written;private final File temporary;private final OutputStream stream;
        private BlobWriter(String key,long size) throws Exception {this.key=key;this.size=size;temporary=File.createTempFile("protec-", ".pending",mediaDirectory);Cipher cipher=encryption();FileOutputStream out=new FileOutputStream(temporary);out.write(cipher.getIV().length);out.write(cipher.getIV());stream=new CipherOutputStream(out,cipher);}
        public void append(byte[] bytes) throws Exception {written+=bytes.length;if(written>size)throw new IOException("Tamanho de vídeo inválido.");stream.write(bytes);}
        public void finish() throws Exception {stream.close();if(written!=size)throw new IOException("O vídeo não foi guardado por inteiro.");File destination=blobFile(key);if(!temporary.renameTo(destination))throw new IOException("Não foi possível confirmar o vídeo no aparelho.");put(key,new JSONObject().put("_blob",true).put("size",size));}
        public void abort(){try{stream.close();}catch(Exception ignored){}temporary.delete();}
    }
    public InputStream openBlob(String key) throws Exception {
        JSONObject metadata=object(key);if(metadata==null||!metadata.optBoolean("_blob"))throw new IOException("Vídeo não encontrado neste aparelho.");
        FileInputStream in=new FileInputStream(blobFile(key));try{int n=in.read();if(n!=12)throw new IOException("Vídeo local inválido.");byte[] iv=new byte[n];new DataInputStream(in).readFully(iv);return new CipherInputStream(in,decryption(iv));}catch(Exception error){in.close();throw error;}
    }
}
