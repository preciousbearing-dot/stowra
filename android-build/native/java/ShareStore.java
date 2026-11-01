package app.stowra.vault;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Pending shares. The share screen writes every share here the moment it arrives, before any animation,
 * so nothing is lost. The main app drains this file when it opens or comes back to the front.
 */
final class ShareStore {
    private static final Object LOCK = new Object();
    private static final long MAX_FILE = 25L * 1024 * 1024;

    private ShareStore() {}

    private static File store(Context c) { return new File(c.getFilesDir(), "pending-shares.json"); }

    private static JSONArray read(Context c) {
        try {
            File f = store(c);
            if (!f.exists()) return new JSONArray();
            byte[] b = new byte[(int) f.length()];
            try (InputStream in = new FileInputStream(f)) { int o = 0; while (o < b.length) { int n = in.read(b, o, b.length - o); if (n < 0) break; o += n; } }
            return new JSONArray(new String(b, StandardCharsets.UTF_8));
        } catch (Throwable t) { return new JSONArray(); }
    }

    private static void write(Context c, JSONArray a) {
        try (OutputStream out = new FileOutputStream(store(c))) { out.write(a.toString().getBytes(StandardCharsets.UTF_8)); } catch (Throwable ignored) { }
    }

    /** Saves what the intent carries and returns the stored record. */
    static JSONObject capture(Context c, Intent i, String referrer) {
        JSONObject r = new JSONObject();
        try {
            String id = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            r.put("id", id);
            r.put("at", System.currentTimeMillis());
            r.put("source", referrer == null ? "" : referrer);
            r.put("mime", i.getType() == null ? "" : i.getType());
            String text = i.getStringExtra(Intent.EXTRA_TEXT);
            String subject = i.getStringExtra(Intent.EXTRA_SUBJECT);
            r.put("text", text == null ? "" : text);
            r.put("subject", subject == null ? "" : subject);
            r.put("reason", "");
            JSONArray files = new JSONArray();
            List<Uri> uris = new ArrayList<>();
            if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
                ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null) uris.addAll(l);
            } else {
                Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            }
            ClipData cd = i.getClipData();
            if (uris.isEmpty() && cd != null) for (int k = 0; k < cd.getItemCount(); k++) { Uri u = cd.getItemAt(k).getUri(); if (u != null) uris.add(u); }
            File dir = new File(c.getFilesDir(), "shares");
            if (!uris.isEmpty() && !dir.exists()) dir.mkdirs();
            for (Uri u : uris) {
                JSONObject f = copy(c, u, dir, id + "_" + files.length());
                if (f != null) files.put(f);
            }
            r.put("files", files);
            synchronized (LOCK) { JSONArray all = read(c); all.put(r); write(c, all); }
        } catch (Throwable ignored) { }
        return r;
    }

    private static JSONObject copy(Context c, Uri u, File dir, String base) {
        try {
            ContentResolver cr = c.getContentResolver();
            String mime = cr.getType(u);
            String name = "file";
            try (Cursor q = cr.query(u, null, null, null, null)) {
                if (q != null && q.moveToFirst()) { int ix = q.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (ix >= 0) name = q.getString(ix); }
            } catch (Throwable ignored) { }
            String ext = "";
            int dot = name.lastIndexOf('.');
            if (dot >= 0 && dot < name.length() - 1 && name.length() - dot <= 8) ext = name.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
            File out = new File(dir, base + ext);
            long total = 0;
            try (InputStream in = cr.openInputStream(u); OutputStream os = new FileOutputStream(out)) {
                if (in == null) return null;
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) { total += n; if (total > MAX_FILE) { out.delete(); return null; } os.write(buf, 0, n); }
            }
            JSONObject f = new JSONObject();
            f.put("path", out.getAbsolutePath());
            f.put("mime", mime == null ? "" : mime);
            f.put("name", name);
            f.put("bytes", total);
            return f;
        } catch (Throwable t) { return null; }
    }

    static void setReason(Context c, String id, String reason) {
        synchronized (LOCK) {
            try {
                JSONArray all = read(c);
                for (int k = 0; k < all.length(); k++) { JSONObject o = all.getJSONObject(k); if (id.equals(o.optString("id"))) o.put("reason", reason); }
                write(c, all);
            } catch (Throwable ignored) { }
        }
    }

    /** Returns every pending share and clears the queue. */
    static JSONArray drain(Context c) {
        synchronized (LOCK) {
            JSONArray all = read(c);
            if (all.length() > 0) write(c, new JSONArray());
            return all;
        }
    }
}
