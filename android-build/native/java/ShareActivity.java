package app.stowra.vault;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/**
 * The Stowing sheet. A translucent screen that appears over the app the person was in, saves the share at once,
 * plays the jar animation (a small local web page) and offers Open Stowra, Add a reason and Keep watching.
 */
public class ShareActivity extends Activity {
    private WebView web;
    private JSONObject share = new JSONObject();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        if (state != null && state.getString("share") != null) {
            // The screen was recreated (for example by rotation). Do not save the same share twice.
            try { share = new JSONObject(state.getString("share")); } catch (Throwable ignored) { }
        } else {
            share = ShareStore.capture(this, getIntent(), referrerPackage());
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setDomStorageEnabled(false);
        web.addJavascriptInterface(new Bridge(), "StowraNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/public/overlay/overlay.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("share", share.toString());
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("StowraNative"); web.destroy(); web = null; }
        super.onDestroy();
    }

    private String referrerPackage() {
        try {
            Uri r = getReferrer();
            if (r != null && "android-app".equals(r.getScheme())) return r.getHost();
        } catch (Throwable ignored) { }
        return "";
    }

    /** What the sheet page may call. */
    private class Bridge {
        @JavascriptInterface public String getShare() { return share.toString(); }

        @JavascriptInterface public String getTheme() {
            SharedPreferences p = getSharedPreferences("stowra_ui", Context.MODE_PRIVATE);
            return p.getString("overlay_theme", "{}");
        }

        @JavascriptInterface public void setReason(String reason) {
            try { share.put("reason", reason == null ? "" : reason); ShareStore.setReason(ShareActivity.this, share.optString("id"), reason == null ? "" : reason); } catch (Throwable ignored) { }
        }

        @JavascriptInterface public void tick() {
            runOnUiThread(() -> { if (web != null) web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); });
        }

        @JavascriptInterface public void openApp() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(ShareActivity.this, MainActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(i);
                } catch (Throwable ignored) { }
                finish();
            });
        }

        @JavascriptInterface public void close() { runOnUiThread(() -> finish()); }
    }
}
