package ru.youchat.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** YOUCHAT для Android: веб-приложение из assets/index.html + push-уведомления, камера, микрофон, файлы. */
public class MainActivity extends Activity {
    static final int REQ_FILE = 11, REQ_PERM = 12, REQ_NOTIF = 13;
    static volatile MainActivity current;
    static volatile boolean foreground = false;

    WebView web;
    ValueCallback<Uri[]> fileCb;
    PermissionRequest pendingPerm;
    String pendingCid;
    boolean loaded = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        current = this;
        createChannel();

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " YOUCHAT-Android/1");

        web.addJavascriptInterface(new Bridge(), "YCNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.startsWith("file:") || u.startsWith("blob:") || u.startsWith("data:")) return false;
                openExternal(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loaded = true;
                deliverCid();
                notifyToken();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(() -> {
                    List<String> need = new ArrayList<>();
                    for (String res : r.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) need.add(Manifest.permission.CAMERA);
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) need.add(Manifest.permission.RECORD_AUDIO);
                    }
                    List<String> missing = new ArrayList<>();
                    for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
                    if (missing.isEmpty()) {
                        r.grant(r.getResources());
                    } else {
                        if (pendingPerm != null) pendingPerm.deny();
                        pendingPerm = r;
                        requestPermissions(missing.toArray(new String[0]), REQ_PERM);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    Intent i = params.createIntent();
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(Intent.createChooser(i, "Выберите файл"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }
        });

        web.setDownloadListener((url, ua, cd, mime, len) -> {
            String name = URLUtil.guessFileName(url, cd, mime);
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                String js = "(async()=>{try{const r=await fetch(" + JSONObject.quote(url) + ");const b=await r.blob();const f=new FileReader();"
                        + "f.onload=()=>YCNative.saveFile(" + JSONObject.quote(name) + ",b.type||'application/octet-stream',String(f.result).split(',')[1]||'');f.readAsDataURL(b)}catch(e){}})()";
                web.evaluateJavascript(js, null);
            } else {
                openExternal(url);
            }
        });

        handleIntent(getIntent());
        web.loadUrl("file:///android_asset/index.html");

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
        initPush();
    }

    void openExternal(String u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
        } catch (Exception e) {
            Toast.makeText(this, "Не удалось открыть ссылку", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    void handleIntent(Intent i) {
        if (i == null) return;
        String cid = i.getStringExtra("cid");
        if (cid != null && !cid.isEmpty()) {
            pendingCid = cid;
            deliverCid();
        }
    }

    void deliverCid() {
        if (!loaded || pendingCid == null || web == null) return;
        final String c = pendingCid;
        pendingCid = null;
        web.postDelayed(() -> web.evaluateJavascript("window.YCOpenChat&&YCOpenChat(" + JSONObject.quote(c) + ")", null), 700);
    }

    void initPush() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this);
            if (FirebaseApp.getApps(this).isEmpty()) return;
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t -> {
                saveToken(this, t);
                notifyToken();
            });
        } catch (Throwable e) {
            // без google-services.json push просто не включается
        }
    }

    static void saveToken(Context c, String t) {
        if (t == null) return;
        c.getSharedPreferences("yc", Context.MODE_PRIVATE).edit().putString("push", t).apply();
    }

    static void notifyToken() {
        final MainActivity a = current;
        if (a == null || a.web == null) return;
        a.runOnUiThread(() -> a.web.evaluateJavascript("window.YCNativePush&&YCNativePush()", null));
    }

    void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel("messages", "Сообщения", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Новые сообщения в чатах, группах и каналах");
            ch.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.YCBack?YCBack():false)", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
        if (web != null) web.evaluateJavascript("window.dispatchEvent&&window.dispatchEvent(new Event('online'))", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        foreground = false;
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCb == null) return;
        Uri[] out = null;
        if (res == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                out = new Uri[]{data.getData()};
            }
        }
        fileCb.onReceiveValue(out);
        fileCb = null;
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req == REQ_PERM && pendingPerm != null) {
            boolean ok = results.length > 0;
            for (int r : results) if (r != PackageManager.PERMISSION_GRANTED) ok = false;
            if (ok) pendingPerm.grant(pendingPerm.getResources());
            else pendingPerm.deny();
            pendingPerm = null;
        }
    }

    /** Мост для страницы: window.YCNative */
    class Bridge {
        @JavascriptInterface
        public String getPushToken() {
            return getSharedPreferences("yc", Context.MODE_PRIVATE).getString("push", "");
        }

        @JavascriptInterface
        public String version() {
            return "1";
        }

        @JavascriptInterface
        public void openUrl(String u) {
            runOnUiThread(() -> openExternal(u));
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String b64) {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String fname = (name == null || name.isEmpty()) ? "youchat-file" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fname);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/YOUCHAT");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("no uri");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) throw new Exception("no stream");
                        os.write(bytes);
                    }
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "YOUCHAT");
                    if (!dir.exists() && !dir.mkdirs()) throw new Exception("no dir");
                    try (FileOutputStream os = new FileOutputStream(new File(dir, fname))) {
                        os.write(bytes);
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Сохранено в «Загрузки/YOUCHAT»", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Не удалось сохранить файл", Toast.LENGTH_SHORT).show());
            }
        }
    }
}
