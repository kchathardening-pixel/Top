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
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
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
    File pendingApk;
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
        if (pendingApk != null && Build.VERSION.SDK_INT >= 26 && getPackageManager().canRequestPackageInstalls()) { File f = pendingApk; web.postDelayed(() -> { if (pendingApk == f) launchInstall(); }, 400); }
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

    void apkJs(String fn, String arg) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript("window." + fn + "&&" + fn + "(" + JSONObject.quote(arg) + ")", null); });
    }

    void launchInstall() {
        if (pendingApk == null || !pendingApk.exists()) return;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            apkJs("YC_APKDONE", "perm");
            startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            return;
        }
        Uri u = apkUri(pendingApk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(u, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); pendingApk = null; apkJs("YC_APKDONE", "ok"); } catch (Exception e) { apkJs("YC_APKDONE", "noinst"); }
    }

    Uri apkUri(File f) {
        return YCFiles.uriFor(this, f);
    }

    /** Мост для страницы: window.YCNative */
    class Bridge {
        @JavascriptInterface
        public String getPushToken() {
            return getSharedPreferences("yc", Context.MODE_PRIVATE).getString("push", "");
        }

        @JavascriptInterface
        public String getContacts() {
            if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, 14));
                return "[]";
            }
            org.json.JSONArray out = new org.json.JSONArray();
            try (android.database.Cursor c = getContentResolver().query(android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER}, null, null, null)) {
                if (c != null) while (c.moveToNext() && out.length() < 3000) {
                    JSONObject o = new JSONObject();
                    o.put("name", c.getString(0) == null ? "" : c.getString(0));
                    o.put("tel", c.getString(1) == null ? "" : c.getString(1));
                    out.put(o);
                }
            } catch (Exception e) { return "[]"; }
            return out.toString();
        }

        @JavascriptInterface
        public String version() {
            return "2";
        }

        /** Версия установленного APK (versionName) */
        @JavascriptInterface
        public String appVersion() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        /** Маркет: скачать APK, сверить SHA-256 и открыть системный установщик Android */
        @JavascriptInterface
        public void installApk(final String url, final String sha, final String name) {
            if (url == null || !url.startsWith("https://")) { apkJs("YC_APKDONE", "bad"); return; }
            new Thread(() -> {
                try {
                    File dir = new File(getCacheDir(), "apk");
                    if (!dir.exists()) dir.mkdirs();
                    File[] old = dir.listFiles();
                    if (old != null) for (File f : old) f.delete();
                    String fname = (name == null ? "youchat.apk" : name.replaceAll("[^\\w.\\-]", "_"));
                    if (!fname.endsWith(".apk")) fname += ".apk";
                    File out = new File(dir, fname);
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(20000); c.setReadTimeout(60000);
                    if (c.getResponseCode() != 200) throw new Exception("http " + c.getResponseCode());
                    long total = c.getContentLengthLong(), got = 0; int last = -1;
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    try (InputStream in = c.getInputStream(); FileOutputStream os = new FileOutputStream(out)) {
                        byte[] buf = new byte[65536]; int n;
                        while ((n = in.read(buf)) > 0) {
                            os.write(buf, 0, n); md.update(buf, 0, n); got += n;
                            if (total > 0) { int p = (int) (got * 100 / total); if (p != last) { last = p; apkJs("YC_APKPROG", String.valueOf(p)); } }
                        }
                    }
                    StringBuilder hx = new StringBuilder();
                    for (byte b : md.digest()) hx.append(String.format("%02x", b));
                    if (sha != null && !sha.isEmpty() && !hx.toString().equalsIgnoreCase(sha)) { out.delete(); apkJs("YC_APKDONE", "hash"); return; }
                    pendingApk = out;
                    runOnUiThread(MainActivity.this::launchInstall);
                } catch (Exception e) {
                    apkJs("YC_APKDONE", "net");
                }
            }).start();
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
