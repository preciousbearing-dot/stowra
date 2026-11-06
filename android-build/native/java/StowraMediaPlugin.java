package app.stowra.vault;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;
import java.io.OutputStream;
import java.nio.ByteBuffer;

/**
 * Media tools that run on the phone. JS name: StowraMedia.
 * recognizeText: reads the text in a picture with ML Kit, with no network.
 * pickVideo: lets the person choose a video, then cuts its sound into small audio files (no re-encoding) and takes a cover frame.
 * cleanup: deletes the audio files made by pickVideo.
 */
@CapacitorPlugin(name = "StowraMedia")
public class StowraMediaPlugin extends Plugin {
    /** Each audio piece stays under this many bytes so one piece fits the 25 MB limit of speech services. */
    private static final long SEGMENT_BYTES = 14L * 1024 * 1024;

    private TextRecognizer recognizer;

    @PluginMethod
    public void recognizeText(final PluginCall call) {
        final String data = call.getString("data");
        if (data == null || data.isEmpty()) { call.reject("No picture was given."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                    BitmapFactory.Options probe = new BitmapFactory.Options();
                    probe.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, probe);
                    int sample = 1;
                    while (Math.max(probe.outWidth, probe.outHeight) / sample > 3000) sample *= 2;
                    BitmapFactory.Options o = new BitmapFactory.Options();
                    o.inSampleSize = sample;
                    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
                    if (bmp == null) { call.reject("The picture could not be opened."); return; }
                    if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    recognizer.process(InputImage.fromBitmap(bmp, 0))
                        .addOnSuccessListener(new com.google.android.gms.tasks.OnSuccessListener<Text>() {
                            @Override public void onSuccess(Text text) {
                                JSObject r = new JSObject();
                                r.put("text", text.getText());
                                JSArray blocks = new JSArray();
                                for (Text.TextBlock b : text.getTextBlocks()) blocks.put(b.getText());
                                r.put("blocks", blocks);
                                call.resolve(r);
                            }
                        })
                        .addOnFailureListener(new com.google.android.gms.tasks.OnFailureListener() {
                            @Override public void onFailure(Exception e) { call.reject("Reading the text failed: " + e.getMessage()); }
                        });
                } catch (Throwable t) {
                    call.reject("Reading the text failed: " + t.getMessage());
                }
            }
        }).start();
    }

    @PluginMethod
    public void pickVideo(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("video/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call, Intent.createChooser(i, "Choose a video"), "pickVideoResult");
    }

    @ActivityCallback
    private void pickVideoResult(final PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject r = new JSObject(); r.put("cancelled", true); call.resolve(r); return;
        }
        final Uri uri = result.getData().getData();
        new Thread(new Runnable() {
            @Override public void run() {
                try { call.resolve(prepareVideo(getContext(), uri)); }
                catch (Throwable t) { call.reject("This video could not be read: " + t.getMessage()); }
            }
        }).start();
    }

    private static String nameOf(Context c, Uri uri) {
        String n = "video";
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(uri, null, null, null, null);
            if (cur != null && cur.moveToFirst()) { int ix = cur.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (ix >= 0) n = cur.getString(ix); }
        } catch (Throwable ignored) { } finally { if (cur != null) cur.close(); }
        return n;
    }

    private static JSObject prepareVideo(Context c, Uri uri) throws Exception { return prepareVideo(c, uri, nameOf(c, uri), true); }

    private static JSObject prepareVideo(Context c, Uri uri, String name, boolean copy) throws Exception {
        JSObject out = new JSObject();
        out.put("name", name);
        long durationMs = 0;
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(c, uri);
            String d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (d != null) durationMs = Long.parseLong(d);
            Bitmap frame = mmr.getFrameAtTime(Math.min(1000000L, durationMs * 250L), MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (frame != null) {
                int w = 640; int h = Math.max(1, Math.round(frame.getHeight() * (w / (float) frame.getWidth())));
                Bitmap small = Bitmap.createScaledBitmap(frame, w, h, true);
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                small.compress(Bitmap.CompressFormat.JPEG, 80, bos);
                out.put("thumb", Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            }
        } catch (Throwable ignored) {
        } finally { try { mmr.release(); } catch (Throwable ignored) { } }
        out.put("durationMs", durationMs);

        File dir = new File(c.getCacheDir(), "media/" + System.currentTimeMillis());
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("No room to work in.");
        out.put("dir", dir.getAbsolutePath());
        out.put("segments", cutAudio(c, uri, dir));
        if (copy) try { out.put("stored", copyIn(c, uri, name)); } catch (Throwable ignored) { /* the sound is still usable without the video file */ }
        return out;
    }

    /** Copies the audio track into small .m4a files without re-encoding. */
    private static JSArray cutAudio(Context c, Uri uri, File dir) throws Exception {
        MediaExtractor ex = new MediaExtractor();
        JSArray segs = new JSArray();
        MediaMuxer mux = null;
        try {
            ex.setDataSource(c, uri, null);
            int track = -1; MediaFormat fmt = null;
            for (int i = 0; i < ex.getTrackCount(); i++) {
                MediaFormat f = ex.getTrackFormat(i);
                String mime = f.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) { track = i; fmt = f; break; }
            }
            if (track < 0) throw new Exception("This video has no sound track.");
            ex.selectTrack(track);
            ByteBuffer buf = ByteBuffer.allocate(512 * 1024);
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            int n = 0; long bytes = 0; long segStartUs = -1; long lastUs = 0; File cur = null; int mt = -1;
            while (true) {
                buf.clear();
                int size = ex.readSampleData(buf, 0);
                long t = ex.getSampleTime();
                boolean end = size < 0;
                if (!end && mux != null && bytes >= SEGMENT_BYTES) {
                    mux.stop(); mux.release(); mux = null;
                    addSeg(segs, cur, segStartUs, lastUs, bytes);
                }
                if (end) break;
                if (mux == null) {
                    n++; cur = new File(dir, "part-" + n + ".m4a");
                    mux = new MediaMuxer(cur.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                    mt = mux.addTrack(fmt); mux.start(); bytes = 0; segStartUs = t;
                }
                info.offset = 0; info.size = size; info.presentationTimeUs = t - segStartUs;
                info.flags = (ex.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_SYNC) != 0 ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
                mux.writeSampleData(mt, buf, info);
                bytes += size; lastUs = t;
                ex.advance();
            }
            if (mux != null) { mux.stop(); mux.release(); mux = null; addSeg(segs, cur, segStartUs, lastUs, bytes); }
        } finally {
            try { if (mux != null) mux.release(); } catch (Throwable ignored) { }
            ex.release();
        }
        return segs;
    }

    private static void addSeg(JSArray segs, File f, long startUs, long endUs, long bytes) {
        JSObject s = new JSObject();
        s.put("path", f.getAbsolutePath());
        s.put("startMs", Math.max(0, startUs) / 1000);
        s.put("durationMs", Math.max(0, endUs - startUs) / 1000);
        s.put("bytes", f.length());
        segs.put(s);
    }

    // ---- Files kept inside the app: videos, recordings and pictures live here instead of the app database. ----

    private static File storeDirOf(Context c) { File d = new File(c.getFilesDir(), "keeps"); if (!d.exists()) d.mkdirs(); return d; }

    /** Only plain file names, never paths. */
    private static File storedFile(Context c, String name) {
        if (name == null || name.isEmpty() || name.contains("/") || name.contains("\\") || name.contains("..")) return null;
        return new File(storeDirOf(c), name);
    }

    /** Copies a chosen file into the app folder, without loading it into memory. */
    private static JSObject copyIn(Context c, Uri uri, String displayName) throws Exception {
        String mime = c.getContentResolver().getType(uri);
        String ext = "";
        int dot = displayName == null ? -1 : displayName.lastIndexOf('.');
        if (dot >= 0 && displayName.length() - dot <= 6) ext = displayName.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
        File out = new File(storeDirOf(c), "v-" + System.currentTimeMillis() + ext);
        InputStream in = c.getContentResolver().openInputStream(uri);
        if (in == null) throw new Exception("Could not open the video.");
        OutputStream os = new FileOutputStream(out);
        try {
            byte[] buf = new byte[256 * 1024]; int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        } catch (Exception e) { os.close(); in.close(); out.delete(); throw e; }
        os.close(); in.close();
        JSObject r = new JSObject();
        r.put("name", out.getName()); r.put("size", out.length()); r.put("mime", mime == null ? "video/mp4" : mime);
        return r;
    }

    @PluginMethod
    public void storeInfo(PluginCall call) {
        JSObject r = new JSObject();
        File dir = storeDirOf(getContext());
        r.put("dir", dir.getAbsolutePath());
        String name = call.getString("name");
        if (name != null) { File f = storedFile(getContext(), name); r.put("exists", f != null && f.exists()); r.put("size", f != null && f.exists() ? f.length() : 0); }
        call.resolve(r);
    }

    /** Writes one piece of a file. The first piece has append false, the rest append true. */
    @PluginMethod
    public void storeChunk(PluginCall call) {
        File f = storedFile(getContext(), call.getString("name"));
        String data = call.getString("base64");
        if (f == null || data == null) { call.reject("Nothing to store."); return; }
        try {
            FileOutputStream os = new FileOutputStream(f, Boolean.TRUE.equals(call.getBoolean("append", false)));
            os.write(Base64.decode(data, Base64.DEFAULT)); os.close();
            JSObject r = new JSObject(); r.put("size", f.length()); call.resolve(r);
        } catch (Throwable t) { call.reject("Could not save the file: " + t.getMessage()); }
    }

    @PluginMethod
    public void deleteStored(PluginCall call) {
        File f = storedFile(getContext(), call.getString("name"));
        if (f != null && f.exists()) f.delete();
        call.resolve();
    }

    /** Copies a kept file into the phone gallery (Movies, Pictures or Music, in a Stowra folder) so other apps can open it. */
    @PluginMethod
    public void exportToGallery(final PluginCall call) {
        final File src = storedFile(getContext(), call.getString("name"));
        final String display = call.getString("displayName", "stowra-file");
        final String mime = call.getString("mime", "application/octet-stream");
        if (src == null || !src.exists()) { call.reject("That file is not on this phone any more."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    Context c = getContext();
                    boolean video = mime.startsWith("video/"); boolean image = mime.startsWith("image/"); boolean audio = mime.startsWith("audio/");
                    String dirName = video ? Environment.DIRECTORY_MOVIES : image ? Environment.DIRECTORY_PICTURES : audio ? Environment.DIRECTORY_MUSIC : Environment.DIRECTORY_DOWNLOADS;
                    JSObject r = new JSObject();
                    if (Build.VERSION.SDK_INT >= 29) {
                        Uri collection = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : audio ? MediaStore.Audio.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                        ContentValues v = new ContentValues();
                        v.put(MediaStore.MediaColumns.DISPLAY_NAME, display);
                        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                        v.put(MediaStore.MediaColumns.RELATIVE_PATH, dirName + "/Stowra");
                        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                        Uri uri = c.getContentResolver().insert(collection, v);
                        if (uri == null) throw new Exception("The phone would not create the file.");
                        OutputStream os = c.getContentResolver().openOutputStream(uri);
                        FileInputStream in = new FileInputStream(src);
                        byte[] buf = new byte[256 * 1024]; int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        os.close(); in.close();
                        v.clear(); v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        c.getContentResolver().update(uri, v, null, null);
                        r.put("where", dirName + "/Stowra");
                    } else {
                        File pub = new File(Environment.getExternalStoragePublicDirectory(dirName), "Stowra");
                        if (!pub.exists() && !pub.mkdirs()) throw new Exception("The phone would not create the folder.");
                        File dst = new File(pub, display);
                        FileInputStream in = new FileInputStream(src); FileOutputStream os = new FileOutputStream(dst);
                        byte[] buf = new byte[256 * 1024]; int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        os.close(); in.close();
                        MediaScannerConnection.scanFile(c, new String[] { dst.getAbsolutePath() }, null, null);
                        r.put("where", dirName + "/Stowra");
                    }
                    call.resolve(r);
                } catch (Throwable t) { call.reject("Could not save to the gallery: " + t.getMessage()); }
            }
        }).start();
    }

    // ---- Downloading, and working on files that are already inside the app. ----

    private final ConcurrentHashMap<String, Boolean> stopped = new ConcurrentHashMap<String, Boolean>();

    private static String extFor(String mime, String url) {
        String m = mime == null ? "" : mime.toLowerCase();
        if (m.contains("video/mp4")) return ".mp4"; if (m.contains("video/webm")) return ".webm"; if (m.contains("video/quicktime")) return ".mov";
        if (m.contains("audio/mp4") || m.contains("audio/x-m4a")) return ".m4a"; if (m.contains("audio/mpeg")) return ".mp3"; if (m.contains("audio/webm")) return ".webm";
        if (m.contains("image/jpeg")) return ".jpg"; if (m.contains("image/png")) return ".png"; if (m.contains("image/webp")) return ".webp"; if (m.contains("image/gif")) return ".gif";
        String path = url == null ? "" : url.split("[?#]")[0];
        int dot = path.lastIndexOf('.');
        if (dot >= 0 && path.length() - dot <= 5) return path.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
        return ".mp4";
    }

    /** Opens an address, following redirects by hand, with the given headers and an optional byte range. */
    private static HttpURLConnection openFollowing(String url, JSObject headers, String range) throws Exception {
        String current = url; HttpURLConnection con = null;
        for (int hop = 0; hop < 6; hop++) {
            con = (HttpURLConnection) new URL(current).openConnection();
            con.setInstanceFollowRedirects(false);
            con.setConnectTimeout(20000); con.setReadTimeout(30000);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) { String k = keys.next(); String v = headers.optString(k, ""); if (!v.isEmpty()) con.setRequestProperty(k, v); }
            if (range != null) con.setRequestProperty("Range", range);
            int code = con.getResponseCode();
            if (code >= 300 && code < 400 && con.getHeaderField("Location") != null) { current = new URL(new URL(current), con.getHeaderField("Location")).toString(); con.disconnect(); continue; }
            break;
        }
        return con;
    }

    /**
     * Downloads one file straight into the app folder, without holding it in memory. Follows redirects, sends the headers it is given,
     * reports progress as "dlprogress" and can be stopped with cancelDownload. Refuses web pages and error answers.
     * With chunkBytes set it asks for the file in ranges of that size, which video servers need for long videos.
     */
    @PluginMethod
    public void downloadFile(final PluginCall call) {
        final String url = call.getString("url");
        final String id = call.getString("id", "d");
        final JSObject headers = call.getObject("headers", new JSObject());
        final long maxBytes = call.getLong("maxBytes", 1500L * 1024L * 1024L);
        final long chunk = call.getLong("chunkBytes", 0L);
        if (url == null || !url.startsWith("http")) { call.reject("That is not a download address."); return; }
        stopped.remove(id);
        new Thread(new Runnable() {
            @Override public void run() {
                File out = null; OutputStream os = null;
                try {
                    long start = 0; long total = -1; long done = 0; long lastTick = 0; String mime = null; String name = null;
                    while (true) {
                        String range = chunk > 0 ? "bytes=" + start + "-" + (start + chunk - 1) : null;
                        HttpURLConnection con = openFollowing(url, headers, range);
                        int code = con.getResponseCode();
                        if (code >= 400) { if (out != null) out.delete(); call.reject("The site refused the download (HTTP " + code + ").", String.valueOf(code)); return; }
                        if (name == null) {
                            mime = con.getContentType();
                            String lower = mime == null ? "" : mime.toLowerCase();
                            if (lower.startsWith("text/") || lower.contains("json") || lower.contains("html")) { call.reject("The site sent a web page, not the file.", "page"); return; }
                            name = "d-" + System.currentTimeMillis() + extFor(mime, url);
                            out = new File(storeDirOf(getContext()), name);
                            os = new FileOutputStream(out);
                        }
                        boolean partial = code == 206;
                        String cr = con.getHeaderField("Content-Range");
                        if (partial && cr != null && cr.contains("/")) { try { total = Long.parseLong(cr.substring(cr.lastIndexOf('/') + 1).trim()); } catch (Exception ignored) { } }
                        else if (!partial) total = con.getContentLengthLong();
                        if (total > maxBytes) { os.close(); out.delete(); call.reject("That file is too large to save.", "large"); return; }
                        InputStream in = con.getInputStream();
                        byte[] buf = new byte[128 * 1024]; int n; long got = 0;
                        while ((n = in.read(buf)) > 0) {
                            if (stopped.containsKey(id)) { os.close(); in.close(); out.delete(); call.reject("Download stopped.", "stopped"); return; }
                            os.write(buf, 0, n); done += n; got += n;
                            if (done > maxBytes) { os.close(); in.close(); out.delete(); call.reject("That file is too large to save.", "large"); return; }
                            long now = System.currentTimeMillis();
                            if (now - lastTick > 400) { lastTick = now; JSObject p = new JSObject(); p.put("id", id); p.put("done", done); p.put("total", total); notifyListeners("dlprogress", p); }
                        }
                        in.close(); con.disconnect();
                        if (!partial || chunk <= 0) break;
                        start += got;
                        if (got == 0 || (total > 0 && start >= total)) break;
                    }
                    os.close();
                    if (out.length() < 1024) { out.delete(); call.reject("The site sent an empty file.", "empty"); return; }
                    JSObject r = new JSObject();
                    r.put("name", name); r.put("size", out.length()); r.put("mime", mime == null ? "video/mp4" : mime.split(";")[0].trim());
                    call.resolve(r);
                } catch (Throwable t) {
                    try { if (os != null) os.close(); } catch (Throwable ignored) { }
                    if (out != null && out.exists()) out.delete();
                    call.reject("The download failed: " + t.getMessage(), "network");
                }
            }
        }).start();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) { String id = call.getString("id"); if (id != null) stopped.put(id, true); call.resolve(); }

    /** Asks how big a download will be without saving anything. Size is -1 when the site does not say. */
    @PluginMethod
    public void probeFile(final PluginCall call) {
        final String url = call.getString("url");
        final JSObject headers = call.getObject("headers", new JSObject());
        if (url == null || !url.startsWith("http")) { call.reject("That is not a download address."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection con = openFollowing(url, headers, "bytes=0-0");
                    int code = con.getResponseCode();
                    if (code >= 400) { call.reject("The site refused (HTTP " + code + ").", String.valueOf(code)); return; }
                    String mime = con.getContentType();
                    String lower = mime == null ? "" : mime.toLowerCase();
                    if (lower.startsWith("text/") || lower.contains("json") || lower.contains("html")) { call.reject("The site sent a web page, not the file.", "page"); return; }
                    long total = -1;
                    String cr = con.getHeaderField("Content-Range");
                    if (code == 206 && cr != null && cr.contains("/")) { try { total = Long.parseLong(cr.substring(cr.lastIndexOf('/') + 1).trim()); } catch (Exception ignored) { } }
                    else if (code == 200) total = con.getContentLengthLong();
                    con.disconnect();
                    JSObject r = new JSObject(); r.put("size", total); r.put("mime", mime == null ? "" : mime.split(";")[0].trim());
                    call.resolve(r);
                } catch (Throwable t) { call.reject("Could not check the size: " + t.getMessage(), "network"); }
            }
        }).start();
    }

    /** A cover picture from a video in the app folder. Tries a few moments in case the first frame is black or unreadable. */
    @PluginMethod
    public void videoFrame(final PluginCall call) {
        final File f = storedFile(getContext(), call.getString("name"));
        if (f == null || !f.exists()) { call.reject("That video is not on this phone any more."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                try {
                    mmr.setDataSource(f.getAbsolutePath());
                    String d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    long dur = d == null ? 0 : Long.parseLong(d);
                    long[] tries = new long[] { Math.min(1000L, dur / 4), dur / 2, 0L };
                    Bitmap frame = null;
                    for (long ms : tries) {
                        try { frame = mmr.getFrameAtTime(ms * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC); } catch (Throwable ignored) { frame = null; }
                        if (frame != null) break;
                    }
                    if (frame == null) { call.reject("No picture could be read from this video."); return; }
                    int w = 640; int h = Math.max(1, Math.round(frame.getHeight() * (w / (float) frame.getWidth())));
                    Bitmap small = Bitmap.createScaledBitmap(frame, w, h, true);
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    small.compress(Bitmap.CompressFormat.JPEG, 80, bos);
                    JSObject r = new JSObject(); r.put("thumb", Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)); r.put("durationMs", dur);
                    call.resolve(r);
                } catch (Throwable t) { call.reject("Could not read this video: " + t.getMessage()); }
                finally { try { mmr.release(); } catch (Throwable ignored) { } }
            }
        }).start();
    }

    /** Cuts the sound out of a video already in the app folder, so it can be transcribed, and takes a cover frame. */
    @PluginMethod
    public void prepareStored(final PluginCall call) {
        final File f = storedFile(getContext(), call.getString("name"));
        if (f == null || !f.exists()) { call.reject("That video is not on this phone any more."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try { call.resolve(prepareVideo(getContext(), Uri.fromFile(f), f.getName(), false)); }
                catch (Throwable t) { call.reject("Could not read the sound in this video: " + t.getMessage()); }
            }
        }).start();
    }

    /** Looks at pictures taken evenly through a video and reads any text on them (links, commands, names). No network. */
    @PluginMethod
    public void scanFrames(final PluginCall call) {
        final File f = storedFile(getContext(), call.getString("name"));
        final int count = Math.max(2, Math.min(call.getInt("count", 24), 60));
        if (f == null || !f.exists()) { call.reject("That video is not on this phone any more."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                try {
                    mmr.setDataSource(f.getAbsolutePath());
                    String d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    long dur = d == null ? 0 : Long.parseLong(d);
                    if (dur <= 0) { call.reject("This video has no length to scan."); return; }
                    if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    JSArray frames = new JSArray();
                    for (int i = 0; i < count; i++) {
                        long at = Math.min(dur - 1, (dur * (2L * i + 1)) / (2L * count));
                        Bitmap b = mmr.getFrameAtTime(at * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                        if (b == null) continue;
                        int w = 1280; if (b.getWidth() > w) { int h = Math.max(1, Math.round(b.getHeight() * (w / (float) b.getWidth()))); b = Bitmap.createScaledBitmap(b, w, h, true); }
                        try {
                            Text t = com.google.android.gms.tasks.Tasks.await(recognizer.process(InputImage.fromBitmap(b, 0)));
                            String text = t.getText();
                            if (text != null && text.trim().length() > 2) { JSObject o = new JSObject(); o.put("atMs", at); o.put("text", text); frames.put(o); }
                        } catch (Throwable ignored) { /* skip this frame */ }
                    }
                    JSObject r = new JSObject(); r.put("frames", frames); r.put("durationMs", dur);
                    call.resolve(r);
                } catch (Throwable t) { call.reject("Scanning the video failed: " + t.getMessage()); }
                finally { try { mmr.release(); } catch (Throwable ignored) { } }
            }
        }).start();
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        String dir = call.getString("dir");
        if (dir != null && dir.startsWith(new File(getContext().getCacheDir(), "media").getAbsolutePath())) {
            File d = new File(dir); File[] fs = d.listFiles();
            if (fs != null) for (File f : fs) f.delete();
            d.delete();
        }
        call.resolve();
    }
}
