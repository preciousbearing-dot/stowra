package app.stowra.vault;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import org.json.JSONArray;
import org.json.JSONObject;

/** Everything the web app needs from Android that the browser cannot do. JS name: StowraNative. */
@CapacitorPlugin(name = "StowraNative")
public class StowraNativePlugin extends Plugin {
    private static final String ALIAS = "stowra_secure_key";

    private SharedPreferences prefs(String name) { return getContext().getSharedPreferences(name, Context.MODE_PRIVATE); }

    /** Shares that arrived through the share sheet since the last time the app asked. */
    @PluginMethod
    public void drainShares(PluginCall call) {
        try {
            JSONArray a = ShareStore.drain(getContext());
            JSObject o = new JSObject();
            o.put("shares", new JSArray(a.toString()));
            call.resolve(o);
        } catch (Throwable t) { call.reject("Could not read shared items."); }
    }

    /** Reads a file a share saved on the phone, as base64 (25 MB cap). Only files inside the app's shares folder. */
    @PluginMethod
    public void readShareFile(PluginCall call) {
        try {
            File f = new File(call.getString("path", ""));
            File dir = new File(getContext().getFilesDir(), "shares");
            if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator) || !f.exists()) { call.reject("File not found."); return; }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = new FileInputStream(f)) { byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); }
            JSObject o = new JSObject();
            o.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(o);
        } catch (Throwable t) { call.reject("Could not read the file."); }
    }

    @PluginMethod
    public void deleteShareFile(PluginCall call) {
        try {
            File f = new File(call.getString("path", ""));
            File dir = new File(getContext().getFilesDir(), "shares");
            if (f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) f.delete();
        } catch (Throwable ignored) { }
        call.resolve();
    }

    /** Colours the status and navigation bars to match the look, and picks dark or light icons. */
    @PluginMethod
    public void setBars(PluginCall call) {
        final String color = call.getString("color", "#FFFFFF");
        final boolean darkIcons = Boolean.TRUE.equals(call.getBoolean("darkIcons", true));
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                int c = Color.parseColor(color);
                w.setStatusBarColor(c);
                w.setNavigationBarColor(c);
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                ic.setAppearanceLightStatusBars(darkIcons);
                ic.setAppearanceLightNavigationBars(darkIcons);
            } catch (Throwable ignored) { }
        });
        call.resolve();
    }

    /** Hands the current look to the share sheet so it matches the app. */
    @PluginMethod
    public void setOverlayTheme(PluginCall call) {
        JSObject t = call.getObject("tokens");
        prefs("stowra_ui").edit().putString("overlay_theme", t == null ? "{}" : t.toString()).apply();
        call.resolve();
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            String url = call.getString("url", "");
            if (!url.startsWith("https://") && !url.startsWith("http://")) { call.reject("Bad address."); return; }
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) { call.reject("No app can open this address."); }
    }

    // ---- secret storage: AES-GCM with a key that never leaves the Android Keystore ----

    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
            return kg.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    @PluginMethod
    public void secureSet(PluginCall call) {
        try {
            String name = call.getString("key", "");
            String value = call.getString("value", "");
            if (name.isEmpty()) { call.reject("Missing name."); return; }
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] ct = c.doFinal(value.getBytes("UTF-8"));
            String packed = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
            prefs("stowra_secure").edit().putString(name, packed).apply();
            call.resolve();
        } catch (Throwable t) { call.reject("Could not store the secret safely."); }
    }

    @PluginMethod
    public void secureGet(PluginCall call) {
        try {
            String packed = prefs("stowra_secure").getString(call.getString("key", ""), null);
            JSObject o = new JSObject();
            if (packed == null) { o.put("value", JSONObject.NULL); call.resolve(o); return; }
            String[] parts = packed.split(":");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            o.put("value", new String(c.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), "UTF-8"));
            call.resolve(o);
        } catch (Throwable t) { call.reject("Could not read the secret."); }
    }

    @PluginMethod
    public void secureDelete(PluginCall call) {
        prefs("stowra_secure").edit().remove(call.getString("key", "")).apply();
        call.resolve();
    }

    /** Saves a file (a backup) into the phone's Downloads folder. */
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        try {
            String name = call.getString("name", "stowra-backup.json").replaceAll("[^A-Za-z0-9._-]", "_");
            String mime = call.getString("mime", "application/json");
            byte[] data = Base64.decode(call.getString("base64", ""), Base64.DEFAULT);
            Context c = getContext();
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri u = c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u == null) { call.reject("Could not create the file."); return; }
                try (OutputStream o = c.getContentResolver().openOutputStream(u)) { o.write(data); }
            } else {
                File d = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                d.mkdirs();
                try (FileOutputStream o = new FileOutputStream(new File(d, name))) { o.write(data); }
            }
            JSObject o = new JSObject();
            o.put("name", name);
            call.resolve(o);
        } catch (Throwable t) { call.reject("Could not save the file."); }
    }
}
