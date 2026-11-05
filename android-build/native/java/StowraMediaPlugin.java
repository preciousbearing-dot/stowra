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

    private static JSObject prepareVideo(Context c, Uri uri) throws Exception {
        JSObject out = new JSObject();
        out.put("name", nameOf(c, uri));
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
        try { out.put("stored", copyIn(c, uri, nameOf(c, uri))); } catch (Throwable ignored) { /* the sound is still usable without the video file */ }
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
