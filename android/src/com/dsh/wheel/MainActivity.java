package com.dsh.wheel;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.provider.OpenableColumns;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class MainActivity extends Activity {

    private static final int REQ_IMPORT = 1001;
    private static final int REQ_EXPORT = 1002;
    private static final int REQ_FONT = 1003;
    private static final int REQ_AUDIO = 1004;
    private static final int REQ_LOCATION = 1005;
    private static final int REQ_TTS_REPLACE = 1006;
    private static final String FONT_HOST = "wheel.local";
    private static final long MAX_FONT_BYTES = 64L * 1024 * 1024;
    private static final long MAX_AUDIO_BYTES = 30L * 1024 * 1024;
    private static final long SYSTEM_TTS_CACHE_MS = 30L * 24 * 60 * 60 * 1000;
    private static final long SOVITS_CACHE_MS = 30L * 24 * 60 * 60 * 1000;
    private static final long CUSTOM_TTS_CACHE_MS = 30L * 24 * 60 * 60 * 1000;

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private MediaPlayer player;
    private File heldTtsFile;
    private java.util.List<File> heldTtsSegments = new java.util.ArrayList<>();
    private final java.util.Map<String, Runnable> synthDone = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, Runnable> synthFail = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, ParcelFileDescriptor> synthPfd = new java.util.concurrent.ConcurrentHashMap<>();
    private boolean heldTtsPlayRequested;
    private boolean heldTtsLoading;
    private String heldTtsError;
    private String heldTtsFallback;
    private float heldTtsSpeed = 1.0f;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Object dbLock = new Object();
    private File dbFile;
    private SharedPreferences prefs;

    private String pendingExportText;
    private byte[] pendingExportBytes;
    private String pendingExportMime;
    private PendingSpeech pendingSpeech;
    private String pendingLocationCb;
    private String pendingTtsReplacePath;
    private boolean locationRequesting = false;

    private static final class PendingSpeech {
        final String text; final float rate; final float pitch;
        PendingSpeech(String t, float r, float p) { text = t; rate = r; pitch = p; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        dbFile = new File(getFilesDir(), "wheels.json");
        prefs = getSharedPreferences("wheel", MODE_PRIVATE);
        File fontDir = new File(getFilesDir(), "fonts");
        if (!fontDir.exists()) fontDir.mkdirs();
        File voiceDir = new File(getFilesDir(), "voices");
        if (!voiceDir.exists()) voiceDir.mkdirs();
        cleanupTtsCache();

        Window win = getWindow();
        win.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 21) {
            win.setStatusBarColor(0xFFF7F7F4);
            win.setNavigationBarColor(0xFFF7F7F4);
        }
        View decor = win.getDecorView();
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        decor.setSystemUiVisibility(flags);

        web = new WebView(this);
        web.setBackgroundColor(0xFFF7F7F4);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setLongClickable(false);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse r = interceptFont(request);
                if (r != null) return r;
                return super.shouldInterceptRequest(view, request);
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");

        initTts();
    }

    private void initTts() {
        tts = new TextToSpeech(getApplicationContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                try {
                    int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                    if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                        ui.post(() -> {
                            try {
                                Toast.makeText(MainActivity.this, "系统语音缺少中文语音包，可在朗读设置里安装", Toast.LENGTH_LONG).show();
                            } catch (Exception ignored) {}
                        });
                    }
                } catch (Exception ignored) {}
                try {
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) {}
                        @Override public void onDone(String id) {
                            if (id != null && id.startsWith("synth_")){
                                closeSynthPfd(id);
                                Runnable r = synthDone.remove(id);
                                synthFail.remove(id);
                                if (r != null) ui.post(r);
                                return;
                            }
                            notifySpeechEnd();
                        }
                        @Override public void onError(String id) {
                            if (id != null && id.startsWith("synth_")){
                                closeSynthPfd(id);
                                Runnable r = synthFail.remove(id);
                                synthDone.remove(id);
                                if (r != null) ui.post(r);
                                return;
                            }
                            notifySpeechEnd();
                        }
                    });
                } catch (Exception ignored) {}
                ttsReady = true;
                PendingSpeech p = pendingSpeech;
                pendingSpeech = null;
                if (p != null) speakInternal(p.text, p.rate, p.pitch, true);
            } else {
                ttsReady = false;
                ui.post(() -> {
                    try {
                        Toast.makeText(MainActivity.this, "系统语音初始化失败，可在设置里改用 GPT-SoVITS 或安装语音引擎", Toast.LENGTH_LONG).show();
                    } catch (Exception ignored) {}
                });
                notifySpeechEnd();
            }
        });
    }

    private void speakInternal(String text, float rate, float pitch, boolean flush) {
        if (text == null) return;
        text = text.trim();
        if (text.isEmpty()) return;
        rate = Math.max(0.4f, Math.min(2.2f, rate));
        pitch = Math.max(0.4f, Math.min(2.2f, pitch));
        if (tts == null || !ttsReady) {
            pendingSpeech = new PendingSpeech(text, rate, pitch);
            return;
        }
        try {
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            int r = tts.speak(text, flush ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, "wheel");
            if (r == TextToSpeech.ERROR) notifySpeechEnd();
        } catch (Exception ignored) {
            notifySpeechEnd();
        }
    }

    private void stopPlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private void eval(String js) {
        ui.post(() -> {
            if (web != null) {
                try { web.evaluateJavascript(js, null); } catch (Exception ignored) {}
            }
        });
    }

    private void notifySpeechEnd() {
        eval("window.__onSpeechEnd&&window.__onSpeechEnd();");
    }

    private void notifySovits(boolean ok, String msg) {
        eval("window.__onSovits&&window.__onSovits(" + ok + "," + JSONObject.quote(msg == null ? "" : msg) + ");");
    }

    private void notifySovitsOk() {
        eval("window.__onSovits&&window.__onSovits(true,'');");
    }

    private String buildTtsUrl(String base, String text, String ref, String promptText,
                               String promptLang, String textLang, String split, float speed) {
        String b = base.trim();
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        if (!b.startsWith("http://") && !b.startsWith("https://")) b = "http://" + b;
        if (!b.endsWith("/tts")) b = b + "/tts";
        Uri.Builder ub = Uri.parse(b).buildUpon();
        ub.appendQueryParameter("text", text);
        ub.appendQueryParameter("text_lang", textLang == null || textLang.isEmpty() ? "zh" : textLang);
        ub.appendQueryParameter("ref_audio_path", ref);
        if (promptText != null && !promptText.isEmpty()) ub.appendQueryParameter("prompt_text", promptText);
        ub.appendQueryParameter("prompt_lang", promptLang == null || promptLang.isEmpty() ? "zh" : promptLang);
        ub.appendQueryParameter("text_split_method", split == null || split.isEmpty() ? "cut5" : split);
        ub.appendQueryParameter("media_type", "wav");
        ub.appendQueryParameter("streaming_mode", "false");
        ub.appendQueryParameter("speed_factor", String.valueOf(speed));
        return ub.build().toString();
    }

    private File downloadWav(String urlStr) throws IOException {
        return downloadAudio(urlStr, "");
    }

    private static String sha1(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] d = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }

    private File downloadAudio(String urlStr, String apiKey) throws IOException {
        cleanupTtsCache();
        final String key = sha1(urlStr);
        final File target = new File(getCacheDir(), "sovits_" + key + ".wav");
        final long now = System.currentTimeMillis();
        if (target.exists() && target.length() > 128) {
            return target;
        }
        if (target.exists()) target.delete();
        final File tmp = new File(getCacheDir(), "sovits_tmp_" + System.currentTimeMillis() + ".wav");
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(urlStr).openConnection();
            c.setRequestMethod("GET");
            c.setConnectTimeout(10000);
            c.setReadTimeout(120000);
            c.setRequestProperty("Accept", "audio/wav,audio/*;q=0.9,*/*;q=0.8");
            if (apiKey != null && !apiKey.isEmpty()) c.setRequestProperty("X-API-Key", apiKey);
            int code = c.getResponseCode();
            if (code != 200) {
                String body = "";
                InputStream es = c.getErrorStream();
                if (es != null) body = new String(readAll(es), StandardCharsets.UTF_8);
                throw new IOException("服务器返回 " + code + (body.isEmpty() ? "" : "：" + shortText(body, 160)));
            }
            String ct = c.getContentType();
            if (ct != null && ct.toLowerCase(Locale.ROOT).contains("application/json")) {
                String body = new String(readAll(c.getInputStream()), StandardCharsets.UTF_8);
                String msg = body;
                try {
                    JSONObject j = new JSONObject(body);
                    if (j.has("message")) msg = j.optString("message");
                } catch (Exception ignored) {}
                throw new IOException("服务器返回错误：" + shortText(msg, 160));
            }
            try (InputStream in = c.getInputStream(); FileOutputStream fos = new FileOutputStream(tmp)) {
                byte[] buf = new byte[16384];
                int n;
                long total = 0;
                while ((n = in.read(buf)) > 0) {
                    fos.write(buf, 0, n);
                    total += n;
                    if (total > 48L * 1024 * 1024) throw new IOException("音频过大");
                }
                fos.flush();
                fos.getFD().sync();
                if (total < 128) throw new IOException("服务器返回的音频是空的");
            }
            if (!tmp.renameTo(target)) throw new IOException("保存音频缓存失败");
            return target;
        } catch (IOException e) {
            if (tmp.exists()) tmp.delete();
            throw e;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void playFile(final File f) { playFile(f, false); }

    private void playFile(final File f, final boolean deleteAfter) {
        ui.post(() -> {
            try {
                stopPlayer();
                MediaPlayer mp = new MediaPlayer();
                mp.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());
                mp.setDataSource(f.getAbsolutePath());
                mp.prepare();
                mp.start();
                player = mp;
                mp.setOnCompletionListener(m -> {
                    try { m.release(); } catch (Exception ignored) {}
                    if (player == m) player = null;
                    notifySpeechEnd();
                    if (deleteAfter) f.delete();
                    // GPT-SoVITS 缓存保留 36 小时，由 cleanupTtsCache 统一清理
                });
                notifySovitsOk();
            } catch (Exception e) {
                if (f.exists()) f.delete();
                notifySovits(false, "播放失败：" + friendlyMessage(e));
                notifySpeechEnd();
            }
        });
    }

    private void holdTtsReset() {
        synchronized (this) {
            heldTtsFile = null;
            heldTtsSegments.clear();
            heldTtsPlayRequested = false;
            heldTtsLoading = false;
            heldTtsError = null;
            heldTtsFallback = null;
            heldTtsSpeed = 1.0f;
        }
    }

    private void holdTtsReady(File f) {
        boolean play = false;
        synchronized (this) {
            heldTtsFile = f;
            heldTtsLoading = false;
            heldTtsError = null;
            play = heldTtsPlayRequested;
        }
        if (play) ui.post(this::playHeldTtsNow);
    }

    private void holdTtsSegmentsReady(java.util.List<File> files) {
        boolean play = false;
        synchronized (this) {
            heldTtsSegments = new java.util.ArrayList<>(files);
            heldTtsFile = null;
            heldTtsLoading = false;
            heldTtsError = null;
            play = heldTtsPlayRequested;
        }
        if (play) ui.post(this::playHeldTtsNow);
    }

    private void holdTtsFailed(String msg, String fallback, float speed) {
        boolean play = false;
        synchronized (this) {
            heldTtsLoading = false;
            heldTtsError = msg == null ? "生成失败" : msg;
            heldTtsFallback = fallback == null ? "" : fallback;
            heldTtsSpeed = speed;
            play = heldTtsPlayRequested;
        }
        if (play) ui.post(this::playHeldTtsNow);
    }

    private void playHeldTtsNow() {
        File f = null;
        java.util.List<File> segs = null;
        String err = null;
        String fb = "";
        float sp = 1.0f;
        synchronized (this) {
            if (!heldTtsSegments.isEmpty()) {
                segs = new java.util.ArrayList<>(heldTtsSegments);
                heldTtsSegments.clear();
                heldTtsError = null;
                heldTtsPlayRequested = false;
            } else if (heldTtsFile != null) {
                f = heldTtsFile;
                heldTtsFile = null;
                heldTtsError = null;
                heldTtsPlayRequested = false;
            } else if (heldTtsError != null) {
                err = heldTtsError;
                fb = heldTtsFallback == null ? "" : heldTtsFallback;
                sp = heldTtsSpeed;
                heldTtsError = null;
                heldTtsFallback = null;
            } else {
                heldTtsPlayRequested = true;
                return;
            }
        }
        if (segs != null && !segs.isEmpty()) {
            playSegmentFiles(segs);
        } else if (f != null) {
            playFile(f, false);
        } else if (fb != null && !fb.trim().isEmpty()) {
            speakInternal(fb, sp, 1.0f, true);
        } else {
            notifySpeechEnd();
        }
    }

    private File writeTempAudio(byte[] data, String format) throws IOException {
        if (data == null || data.length < 128) throw new IOException("服务器返回的音频是空的");
        String ext = "wav";
        if (format != null && format.toLowerCase(Locale.ROOT).contains("mp3")) ext = "mp3";
        File f = new File(getCacheDir(), "custom_tts_" + System.nanoTime() + "." + ext);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
            out.flush();
            out.getFD().sync();
        }
        return f;
    }

    private byte[] readHttpBytes(HttpURLConnection c, String key, String authHeader, String jsonBody) throws IOException {
        c.setConnectTimeout(15000);
        c.setReadTimeout(120000);
        c.setRequestProperty("Accept", "audio/*,application/json");
        if (key != null && !key.isEmpty()) {
            if ("api-key".equals(authHeader)) c.setRequestProperty("api-key", key);
            else c.setRequestProperty("Authorization", "Bearer " + key);
        }
        if (jsonBody != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = c.getOutputStream()) {
                out.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
        }
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) {
            InputStream es = c.getErrorStream();
            String body = es == null ? "" : new String(readAll(es), StandardCharsets.UTF_8);
            String msg = body;
            try { msg = new JSONObject(body).optString("message", body); } catch (Exception ignored) {}
            throw new IOException("服务器返回 " + code + (msg.isEmpty() ? "" : "：" + shortText(msg, 160)));
        }
        return readAll(c.getInputStream());
    }

    private String postJson(HttpURLConnection c, String key, String authHeader, String jsonBody) throws IOException {
        byte[] raw = readHttpBytes(c, key, authHeader, jsonBody);
        return new String(raw, StandardCharsets.UTF_8);
    }

    private File fetchOpenAiTts(String url, String key, String model, String voice, String format, String text, float speed, String mode, String design) throws IOException {
        JSONObject b = new JSONObject();
        try {
            b.put("model", model == null || model.trim().isEmpty() ? "tts-1" : model.trim());
            b.put("input", text);
            b.put("voice", voice == null || voice.trim().isEmpty() ? "alloy" : voice.trim());
            b.put("response_format", format == null || format.trim().isEmpty() ? "mp3" : format.trim());
            b.put("speed", speed);
            if ("design".equals(mode) && design != null && !design.trim().isEmpty()) b.put("instructions", design.trim());
        } catch (Exception e) { throw new IOException("自定义 TTS 参数无效"); }
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setRequestMethod("POST");
            byte[] raw = readHttpBytes(c, key, "bearer", b.toString());
            String ct = c.getContentType();
            if (ct != null && ct.toLowerCase(Locale.ROOT).contains("application/json")) {
                String msg = new String(raw, StandardCharsets.UTF_8);
                try { msg = new JSONObject(msg).optString("message", msg); } catch (Exception ignored) {}
                throw new IOException("服务器返回错误：" + shortText(msg, 160));
            }
            return writeTempAudio(raw, format);
        } finally { c.disconnect(); }
    }

    private File fetchGetTts(String url, String key, String model, String voice, String text, String format) throws IOException {
        String enc = URLEncoder.encode(text == null ? "" : text, "UTF-8");
        String u = url.replace("{text}", enc).replace("{voice}", URLEncoder.encode(voice == null ? "" : voice, "UTF-8"))
                .replace("{model}", URLEncoder.encode(model == null ? "" : model, "UTF-8"));
        if (url.indexOf("{text}") < 0){
            u += (u.indexOf('?') >= 0 ? "&" : "?") + "text=" + enc;
        }
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        try {
            c.setRequestMethod("GET");
            if (key != null && !key.isEmpty()) {
                c.setRequestProperty("Authorization", "Bearer " + key);
                c.setRequestProperty("api-key", key);
            }
            c.setConnectTimeout(15000);
            c.setReadTimeout(120000);
            int code = c.getResponseCode();
            if (code != 200){
                InputStream es = c.getErrorStream();
                String body = es == null ? "" : new String(readAll(es), StandardCharsets.UTF_8);
                throw new IOException("服务器返回 " + code + (body.isEmpty() ? "" : "：" + shortText(body, 160)));
            }
            String ct = c.getContentType();
            if (ct != null && ct.toLowerCase(Locale.ROOT).contains("application/json")) {
                String body = new String(readAll(c.getInputStream()), StandardCharsets.UTF_8);
                try { body = new JSONObject(body).optString("message", body); } catch (Exception ignored) {}
                throw new IOException("服务器返回错误：" + shortText(body, 160));
            }
            return writeTempAudio(readAll(c.getInputStream()), format);
        } finally { c.disconnect(); }
    }

    private String referenceAudioDataUrl(String path) throws IOException {
        if (path == null || path.trim().isEmpty()) throw new IOException("请先选择参考音频");
        File f = new File(path.trim());
        String root = getFilesDir().getCanonicalPath();
        String canonical = f.getCanonicalPath();
        if (!canonical.startsWith(root + File.separator)) throw new IOException("参考音频路径无效");
        if (!f.exists() || f.length() < 1024) throw new IOException("参考音频不存在或太小");
        if (f.length() > MAX_AUDIO_BYTES) throw new IOException("参考音频超过 30MB");
        String ext = extensionOf(f.getName());
        String mime;
        if ("mp3".equals(ext)) mime = "audio/mpeg";
        else if ("wav".equals(ext)) mime = "audio/wav";
        else throw new IOException("MiMo 音色克隆仅支持 mp3 / wav 参考音频");
        byte[] data = readAll(new FileInputStream(f));
        return "data:" + mime + ";base64," + Base64.encodeToString(data, Base64.NO_WRAP);
    }

    private File fetchMiMoTts(String url, String key, String model, String voice, String format, String text,
                              String mode, String design, String refPath) throws IOException {

        String actualModel = model == null ? "" : model.trim();
        if (actualModel.isEmpty()){
            if ("design".equals(mode)) actualModel = "mimo-v2.5-tts-voicedesign";
            else if ("clone".equals(mode)) actualModel = "mimo-v2.5-tts-voiceclone";
            else actualModel = "mimo-v2.5-tts";
        }
        if ("design".equals(mode) && (design == null || design.trim().isEmpty())){
            throw new IOException("请先填写音色描述");
        }
        if ("clone".equals(mode) && (refPath == null || refPath.trim().isEmpty())){
            throw new IOException("请先选择参考音频");
        }
        JSONObject b = new JSONObject();
        try {
            b.put("model", actualModel);
            JSONArray msgs = new JSONArray();
            if ("design".equals(mode)){
                JSONObject user = new JSONObject();
                user.put("role", "user");
                user.put("content", design.trim());
                msgs.put(user);
            }
            JSONObject msg = new JSONObject();
            msg.put("role", "assistant");
            msg.put("content", text);
            msgs.put(msg);
            b.put("messages", msgs);
            JSONObject audio = new JSONObject();
            audio.put("format", format == null || format.trim().isEmpty() ? "mp3" : format.trim());
            if ("clone".equals(mode)){
                audio.put("voice", referenceAudioDataUrl(refPath));
            } else if (!"design".equals(mode)){
                audio.put("voice", voice == null || voice.trim().isEmpty() ? "mimo_default" : voice.trim());
            }
            b.put("audio", audio);
        } catch (IOException e) { throw e; }
        catch (Exception e) { throw new IOException("MiMo TTS 参数无效"); }
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setRequestMethod("POST");
            String body = postJson(c, key, "api-key", b.toString());
            JSONObject j = new JSONObject(body);
            JSONArray choices = j.optJSONArray("choices");
            if (choices == null || choices.length() == 0) throw new IOException("MiMo 返回里没有音频");
            String data = choices.getJSONObject(0).getJSONObject("message").getJSONObject("audio").optString("data", "");
            if (data.isEmpty()) throw new IOException("MiMo 返回里没有音频");
            byte[] audio = Base64.decode(data, Base64.DEFAULT);
            return writeTempAudio(audio, format);
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("MiMo 返回格式不正确：" + friendlyMessage(e));
        } finally { c.disconnect(); }
    }

    private void exportTtsCacheZip(java.util.List<File> files) {
        try {
            files.sort((a, b) -> Long.compare(a.lastModified(), b.lastModified()));
            if (files.isEmpty()) {
                eval("window.__onTtsCacheEmpty&&window.__onTtsCacheEmpty();");
                return;
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(bos)) {
                StringBuilder manifest = new StringBuilder();
                manifest.append("云海转盘 · 朗读缓存\n");
                manifest.append("系统 TTS 不产生缓存文件，未包含。\n\n");
                for (File f : files) {
                    manifest.append(f.getName()).append("  ").append(f.length()).append(" bytes\n");
                    ZipEntry e = new ZipEntry(f.getName());
                    e.setTime(f.lastModified());
                    zos.putNextEntry(e);
                    try (FileInputStream in = new FileInputStream(f)) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) zos.write(buf, 0, n);
                    }
                    zos.closeEntry();
                }
                ZipEntry m = new ZipEntry("README.txt");
                zos.putNextEntry(m);
                zos.write(manifest.toString().getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
            byte[] data = bos.toByteArray();
            if (data.length == 0) {
                eval("window.__onTtsCacheEmpty&&window.__onTtsCacheEmpty();");
                return;
            }
            pendingExportBytes = data;
            pendingExportMime = "application/zip";
            final String name = "云海转盘-朗读缓存_" + new java.text.SimpleDateFormat("yyyyMMdd_HHmm", java.util.Locale.ROOT).format(new java.util.Date()) + ".zip";
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/zip");
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(i, REQ_EXPORT);
                } catch (Exception e) {
                    pendingExportBytes = null;
                    eval("window.__onExportResult&&window.__onExportResult(false);");
                }
            });
        } catch (Exception e) {
            eval("window.__onExportResult&&window.__onExportResult(false);");
        }
    }

    private static String sha1File(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IOException("读取参考音频失败");
        }
    }

    private static void copyFile(File src, File dst) throws IOException {
        try (FileInputStream in = new FileInputStream(src); FileOutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            out.flush();
            out.getFD().sync();
        }
    }

    private File customCacheFile(String key, String format) {
        String ext = format != null && format.toLowerCase(Locale.ROOT).contains("mp3") ? "mp3" : "wav";
        return new File(getCacheDir(), "custom_tts_" + sha1(key) + "." + ext);
    }

    private String customEngineKey(JSONObject o, String provider, String url, String model, String voice, String mode, String format, float speed, String refPath) throws IOException {
        String key = provider + "|" + url + "|" + model + "|" + voice + "|" + mode + "|" + format + "|" + speed;
        if ("clone".equals(mode) && refPath != null && !refPath.trim().isEmpty()) key += "|ref:" + sha1File(new File(refPath.trim()));
        return key;
    }

    private File segmentCacheFile(String engineKey, String category, String text, String format) {
        String ext = format != null && format.toLowerCase(Locale.ROOT).contains("mp3") ? "mp3" : "wav";
        File dir = new File(new File(getFilesDir(), "tts_cache"), sha1(engineKey).substring(0, 16) + "/" + category);
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, sha1(text) + "." + ext);
    }

    private void writeSovitsMeta(File audio, String text, String engine, String payload) {
        try {
            JSONObject m = new JSONObject();
            m.put("text", text);
            m.put("category", engine);
            m.put("engine", engine);
            m.put("payload", payload == null ? "" : payload);
            m.put("lastUsed", System.currentTimeMillis());
            File meta = new File(audio.getParentFile(), audio.getName() + ".json");
            try (FileOutputStream out = new FileOutputStream(meta)) {
                out.write(m.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {}
    }

    private void writeSegmentMeta(File audio, String text, String category) {
        try {
            JSONObject m = new JSONObject();
            m.put("text", text);
            m.put("category", category);
            m.put("lastUsed", System.currentTimeMillis());
            File meta = new File(audio.getParentFile(), audio.getName() + ".json");
            try (FileOutputStream out = new FileOutputStream(meta)) {
                out.write(m.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {}
    }

    private File fetchSegmentAudio(String provider, String url, String key, String model, String voice,
                                   String format, String mode, String design, String refPath, String text, float speed) throws IOException {
        if ("mimo".equals(provider)) return fetchMiMoTts(url, key, model, voice, format, text, mode, design, refPath);
        if ("get".equals(provider)) return fetchGetTts(url, key, model, voice, text, format);
        return fetchOpenAiTts(url, key, model, voice, format, text, speed, mode, design);
    }

    private void speakCustomSegmentsTask(String payload) {
        String fallback = "";
        float speed = 1.0f;
        boolean hold = false;
        try {
            JSONObject o = new JSONObject(payload == null ? "{}" : payload);
            fallback = o.optString("fallback", "");
            speed = (float) o.optDouble("speed", 1.0);
            boolean holdFlag = o.optBoolean("hold", false);
            hold = holdFlag;
            String provider = o.optString("provider", "openai");
            String url = o.optString("url", "").trim();
            if (url.isEmpty()) throw new IOException("还没有填写 TTS API 地址");
            String key = o.optString("key", "");
            String model = o.optString("model", "");
            String voice = o.optString("voice", "");
            String format = o.optString("format", "mp3");
            String mode = o.optString("mode", "clone");
            String design = o.optString("design", "");
            String refPath = o.optString("refPath", "");
            String engineKey = customEngineKey(o, provider, url, model, voice, mode, format, speed, refPath);
            JSONArray parts = o.optJSONArray("parts");
            if (parts == null || parts.length() == 0) throw new IOException("没有可朗读的片段");
            java.util.List<File> files = new java.util.ArrayList<>();
            long now = System.currentTimeMillis();
            for (int i = 0; i < parts.length(); i++) {
                JSONObject p = parts.getJSONObject(i);
                String text = p.optString("text", "");
                String category = p.optString("category", "template");
                if (text.trim().isEmpty()) continue;
                File cache = segmentCacheFile(engineKey, category, text, format);
                boolean dynamic = "dynamic".equals(category);
                if (cache.exists() && cache.length() > 128) {
                    cache.setLastModified(now);
                    writeSegmentMeta(cache, text, category);
                    files.add(cache);
                    continue;
                }
                if (cache.exists()) cache.delete();
                File temp = fetchSegmentAudio(provider, url, key, model, voice, format, mode, design, refPath, text, speed);
                if (!temp.renameTo(cache)) {
                    copyFile(temp, cache);
                    temp.delete();
                }
                cache.setLastModified(now);
                writeSegmentMeta(cache, text, category);
                files.add(cache);
            }
            if (files.isEmpty()) throw new IOException("没有可朗读的片段");
            if (hold) holdTtsSegmentsReady(files);
            else playSegmentFiles(files);
        } catch (Exception e) {
            final String msg = friendlyMessage(e);
            final String fb = fallback;
            final float sp = speed;
            notifySovits(false, msg);
            if (hold) holdTtsFailed(msg, fb, sp);
            else if (fb != null && !fb.trim().isEmpty()) ui.post(() -> speakInternal(fb, sp, 1.0f, true));
            else notifySpeechEnd();
        }
    }

    private void playSegmentFiles(java.util.List<File> files) {
        if (files == null || files.isEmpty()) { notifySpeechEnd(); return; }
        final java.util.List<File> copy = new java.util.ArrayList<>(files);
        ui.post(() -> {
            stopPlayer();
            playSegmentAt(copy, 0);
        });
    }

    private void playSegmentAt(java.util.List<File> files, int index) {
        if (index >= files.size()) { notifySpeechEnd(); return; }
        File f = files.get(index);
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            mp.setDataSource(f.getAbsolutePath());
            mp.prepare();
            mp.start();
            player = mp;
            mp.setOnCompletionListener(m -> {
                try { m.release(); } catch (Exception ignored) {}
                if (player == m) player = null;
                ui.post(() -> playSegmentAt(files, index + 1));
            });
        } catch (Exception e) {
            ui.post(() -> playSegmentAt(files, index + 1));
        }
    }

    private File ttsFileForPath(String path) throws IOException {
        if (path == null || path.trim().isEmpty()) return null;
        File f = new File(path.trim());
        String canonical = f.getCanonicalPath();
        String cacheRoot = getCacheDir().getCanonicalPath();
        String segmentRoot = new File(getFilesDir(), "tts_cache").getCanonicalPath();
        if (!canonical.startsWith(cacheRoot + File.separator) && !canonical.startsWith(segmentRoot + File.separator)) return null;
        String n = f.getName().toLowerCase(Locale.ROOT);
        if (!n.endsWith(".mp3") && !n.endsWith(".wav") && !n.endsWith(".m4a")) return null;
        return f;
    }

    private void collectTtsFiles(File dir, java.util.List<File> out, int depth) {
        if (dir == null || depth > 4) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) collectTtsFiles(f, out, depth + 1);
            else {
                String n = f.getName().toLowerCase(Locale.ROOT);
                if ((n.endsWith(".mp3") || n.endsWith(".wav") || n.endsWith(".m4a"))
                        && !n.startsWith("sovits_tmp_") && !n.startsWith("tts_tmp_")) out.add(f);
            }
        }
    }

    private String ttsKind(File f) {
        String n = f.getName();
        if (n.startsWith("tts_")) return "system";
        if (n.startsWith("custom_tts_")) return "custom";
        if (n.startsWith("sovits_")) return "sovits";
        File p = f.getParentFile();
        if (p != null){
            String pn = p.getName();
            if ("template".equals(pn)) return "template";
            if ("number".equals(pn)) return "number";
            if ("time".equals(pn)) return "time";
            if ("dynamic".equals(pn)) return "dynamic";
        }
        return "other";
    }

    private File systemCacheFile(String text, float rate, float pitch) {
        String engine = "";
        try { engine = tts == null ? "" : tts.getDefaultEngine(); } catch (Exception ignored) {}
        String key = "system|" + engine + "|" + Locale.getDefault().toLanguageTag() + "|" + text + "|" + rate + "|" + pitch;
        return new File(getCacheDir(), "tts_" + sha1(key) + ".wav");
    }

    private void closeSynthPfd(String id) {
        ParcelFileDescriptor pfd = synthPfd.remove(id);
        if (pfd != null) { try { pfd.close(); } catch (Exception ignored) {} }
    }

    private void synthSystemToFile(String text, float rate, float pitch, File target, Runnable ok, Runnable fail) {
        ui.post(() -> {
            if (tts == null || !ttsReady){ fail.run(); return; }
            try {
                File parent = target.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                if (target.exists()) target.delete();
                final String id = "synth_" + System.nanoTime();
                synthDone.put(id, () -> {
                    if (target.exists() && target.length() > 128) ok.run();
                    else fail.run();
                });
                synthFail.put(id, fail);
                tts.setSpeechRate(Math.max(0.4f, Math.min(2.2f, rate)));
                tts.setPitch(Math.max(0.4f, Math.min(2.2f, pitch)));
                ParcelFileDescriptor pfd = ParcelFileDescriptor.open(target,
                        ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_WRITE_ONLY | ParcelFileDescriptor.MODE_TRUNCATE);
                synthPfd.put(id, pfd);
                int r = tts.synthesizeToFile(text, new Bundle(), pfd, id);
                if (r == TextToSpeech.ERROR){
                    closeSynthPfd(id);
                    synthDone.remove(id); synthFail.remove(id); fail.run();
                }
            } catch (Exception e) {
                fail.run();
            }
        });
    }

    private void speakSystemCachedTask(String payload) {
        String fallback = "";
        float rate = 1.0f, pitch = 1.0f;
        boolean hold = false;
        try {
            JSONObject o = new JSONObject(payload == null ? "{}" : payload);
            final String text = o.optString("text", "").trim();
            fallback = o.optString("fallback", "");
            rate = (float) o.optDouble("rate", 1.0);
            pitch = (float) o.optDouble("pitch", 1.0);
            hold = o.optBoolean("hold", false);
            if (text.isEmpty()) throw new IOException("朗读内容为空");
            final File cache = systemCacheFile(text, rate, pitch);
            long now = System.currentTimeMillis();
            if (cache.exists() && cache.length() > 128 && now - cache.lastModified() <= SYSTEM_TTS_CACHE_MS){
                cache.setLastModified(now);
                if (hold) holdTtsReady(cache);
                else playFile(cache, false);
                return;
            }
            final File tmp = new File(getCacheDir(), "tts_tmp_" + System.nanoTime() + ".wav");
            final boolean h = hold;
            final String fb = fallback;
            final float rt = rate, pt = pitch;
            synthSystemToFile(text, rate, pitch, tmp, () -> {
                try {
                    if (cache.exists()) cache.delete();
                    if (!tmp.renameTo(cache)) { copyFile(tmp, cache); tmp.delete(); }
                } catch (Exception ignored) {}
                if (h) holdTtsReady(cache);
                else playFile(cache, false);
            }, () -> {
                if (tmp.exists()) tmp.delete();
                notifySovits(false, "系统语音生成失败");
                if (h) holdTtsFailed("系统语音生成失败", fb, rt);
                else if (fb != null && !fb.trim().isEmpty()) ui.post(() -> speakInternal(fb, rt, pt, true));
                else notifySpeechEnd();
            });
        } catch (Exception e) {
            final String msg = friendlyMessage(e);
            final String fb = fallback;
            final float rt = rate, pt = pitch;
            if (hold) holdTtsFailed(msg, fb, rt);
            else if (fb != null && !fb.trim().isEmpty()) ui.post(() -> speakInternal(fb, rt, pt, true));
            else notifySpeechEnd();
        }
    }

    private File systemSegmentCacheFile(String engineKey, String category, String text) {
        File dir = new File(new File(getFilesDir(), "tts_cache_system"), sha1(engineKey).substring(0, 16) + "/" + category);
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, sha1(text) + ".wav");
    }

    private void fillSystemSegments(JSONArray parts, int index, java.util.List<File> files, String engineKey,
                                    float rate, float pitch, boolean hold, String fallback) {
        if (index >= parts.length()){
            if (files.isEmpty()) holdTtsFailed("没有可朗读的片段", fallback, rate);
            else if (hold) holdTtsSegmentsReady(files);
            else playSegmentFiles(files);
            return;
        }
        try {
            JSONObject p = parts.getJSONObject(index);
            final String text = p.optString("text", "");
            final String category = p.optString("category", "template");
            if (text.trim().isEmpty()){ fillSystemSegments(parts, index + 1, files, engineKey, rate, pitch, hold, fallback); return; }
            final File cache = systemSegmentCacheFile(engineKey, category, text);
            long now = System.currentTimeMillis();
            if (cache.exists() && cache.length() > 128 && now - cache.lastModified() <= SYSTEM_TTS_CACHE_MS){
                cache.setLastModified(now);
                writeSegmentMeta(cache, text, category);
                files.add(cache);
                fillSystemSegments(parts, index + 1, files, engineKey, rate, pitch, hold, fallback);
                return;
            }
            final File tmp = new File(getCacheDir(), "tts_tmp_" + System.nanoTime() + ".wav");
            final java.util.List<File> out = files;
            synthSystemToFile(text, rate, pitch, tmp, () -> {
                try {
                    if (cache.exists()) cache.delete();
                    if (!tmp.renameTo(cache)){ copyFile(tmp, cache); tmp.delete(); }
                } catch (Exception ignored) {}
                cache.setLastModified(System.currentTimeMillis());
                writeSegmentMeta(cache, text, category);
                out.add(cache);
                fillSystemSegments(parts, index + 1, out, engineKey, rate, pitch, hold, fallback);
            }, () -> {
                if (tmp.exists()) tmp.delete();
                notifySovits(false, "系统语音片段生成失败");
                holdTtsFailed("系统语音片段生成失败", fallback, rate);
            });
        } catch (Exception e) {
            holdTtsFailed("系统语音片段参数无效", fallback, rate);
        }
    }

    private void speakSystemSegmentsTask(String payload) {
        String fallback = "";
        float rate = 1.0f, pitch = 1.0f;
        boolean hold = false;
        try {
            JSONObject o = new JSONObject(payload == null ? "{}" : payload);
            fallback = o.optString("fallback", "");
            rate = (float) o.optDouble("rate", 1.0);
            pitch = (float) o.optDouble("pitch", 1.0);
            hold = o.optBoolean("hold", false);
            JSONArray parts = o.optJSONArray("parts");
            if (parts == null || parts.length() == 0) throw new IOException("没有可朗读的片段");
            String engine = "";
            try { engine = tts == null ? "" : tts.getDefaultEngine(); } catch (Exception ignored) {}
            String engineKey = "system|" + engine + "|" + rate + "|" + pitch;
            fillSystemSegments(parts, 0, new java.util.ArrayList<>(), engineKey, rate, pitch, hold, fallback);
        } catch (Exception e) {
            final String msg = friendlyMessage(e);
            final String fb = fallback;
            final float rt = rate, pt = pitch;
            notifySovits(false, msg);
            if (hold) holdTtsFailed(msg, fb, rt);
            else if (fb != null && !fb.trim().isEmpty()) ui.post(() -> speakInternal(fb, rt, pt, true));
            else notifySpeechEnd();
        }
    }

    private void regenerateTtsFileTask(String path, String configJson) {
        try {
            File target = ttsFileForPath(path);
            if (target == null || !target.exists()) throw new IOException("文件不存在");
            String n = target.getName();
            if (n.startsWith("tts_")) throw new IOException("系统 TTS 暂不支持重新生成");
            File meta = new File(target.getParentFile(), target.getName() + ".json");
            if (!meta.exists()) throw new IOException("缺少音频文本信息");
            String text = "";
            String category = "custom";
            JSONObject saved = null;
            try (FileInputStream in = new FileInputStream(meta)) {
                JSONObject m = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
                text = m.optString("text", "");
                category = m.optString("category", "custom");
                saved = m;
            }
            if (text.trim().isEmpty()) throw new IOException("缺少音频文本");
            File temp;
            if (n.startsWith("sovits_")){
                String engine = saved.optString("engine", "");
                JSONObject p = new JSONObject(saved.optString("payload", "{}"));
                if ("clone".equals(engine)){
                    String base = normalizeBase(p.optString("url", ""));
                    String key = p.optString("key", "");
                    String voiceId = p.optString("voiceId", "");
                    Uri.Builder ub = Uri.parse(base + "/tts").buildUpon();
                    ub.appendQueryParameter("text", text);
                    ub.appendQueryParameter("voice_id", voiceId);
                    ub.appendQueryParameter("speed_factor", String.valueOf(p.optDouble("speed", 1.0)));
                    temp = downloadAudio(ub.build().toString(), key);
                } else {
                    String base = p.optString("url", "").trim();
                    String ref = p.optString("refAudio", "").trim();
                    String prompt = p.optString("promptText", "");
                    String promptLang = p.optString("promptLang", "zh");
                    String textLang = p.optString("textLang", "zh");
                    String split = p.optString("split", "cut5");
                    float sp = (float) p.optDouble("speed", 1.0);
                    temp = downloadWav(buildTtsUrl(base, text, ref, prompt, promptLang, textLang, split, sp));
                }
                if (target.exists()) target.delete();
                if (!temp.renameTo(target)) { copyFile(temp, target); temp.delete(); }
                target.setLastModified(System.currentTimeMillis());
                writeSovitsMeta(target, text, engine, saved.optString("payload", ""));
                eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(true,'已重新生成');");
                return;
            }
            JSONObject o = new JSONObject(configJson == null ? "{}" : configJson);
            String provider = o.optString("provider", "openai");
            String url = o.optString("url", "").trim();
            if (url.isEmpty()) throw new IOException("还没有填写 TTS API 地址");
            String key = o.optString("key", "");
            String model = o.optString("model", "");
            String voice = o.optString("voice", "");
            String format = o.optString("format", "mp3");
            String mode = o.optString("mode", "builtin");
            String design = o.optString("design", "");
            String refPath = o.optString("refPath", "");
            float speed = (float) o.optDouble("speed", 1.0);
            temp = fetchSegmentAudio(provider, url, key, model, voice, format, mode, design, refPath, text, speed);
            if (target.exists()) target.delete();
            if (!temp.renameTo(target)) { copyFile(temp, target); temp.delete(); }
            target.setLastModified(System.currentTimeMillis());
            writeSegmentMeta(target, text, category);
            eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(true,'已重新生成');");
        } catch (Exception e) {
            eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(false," + JSONObject.quote(friendlyMessage(e)) + ");");
        }
    }

    private void customTtsTask(String payload) {
        String fallback = "";
        float speed = 1.0f;
        boolean hold = false;
        try {
            JSONObject o = new JSONObject(payload == null ? "{}" : payload);
            String text = o.optString("text", "").trim();
            fallback = o.optString("fallback", "");
            speed = (float) o.optDouble("speed", 1.0);
            if (text.isEmpty()) throw new IOException("朗读内容为空");
            String provider = o.optString("provider", "openai");
            String url = o.optString("url", "").trim();
            if (url.isEmpty()) throw new IOException("还没有填写 TTS API 地址");
            String key = o.optString("key", "");
            String model = o.optString("model", "");
            String voice = o.optString("voice", "");
            String format = o.optString("format", "mp3");
            String mode = o.optString("mode", "builtin");
            String design = o.optString("design", "");
            String refPath = o.optString("refPath", "");
            hold = o.optBoolean("hold", false);
            boolean cacheable = true;
            File cache = null;
            if (cacheable){
                String cacheKey = provider + "|" + url + "|" + model + "|" + voice + "|" + mode + "|" + format + "|" + speed + "|" + text + (("design".equals(mode)) ? "|design:" + design : "");
                if ("clone".equals(mode) && refPath != null && !refPath.trim().isEmpty()){
                    cacheKey += "|ref:" + sha1File(new File(refPath.trim()));
                }
                cache = customCacheFile(cacheKey, format);
                long now = System.currentTimeMillis();
                if (cache.exists() && cache.length() > 128){
                    cache.setLastModified(now);
                    writeSegmentMeta(cache, text, "custom");
                    if (hold) holdTtsReady(cache);
                    else playFile(cache, false);
                    return;
                }
            }
            File f;
            if ("mimo".equals(provider)) f = fetchMiMoTts(url, key, model, voice, format, text, mode, design, refPath);
            else if ("get".equals(provider)) f = fetchGetTts(url, key, model, voice, text, format);
            else f = fetchOpenAiTts(url, key, model, voice, format, text, speed, mode, design);
            if (cache != null){
                if (cache.exists()) cache.delete();
                if (!f.renameTo(cache)){
                    try { copyFile(f, cache); f.delete(); } catch (Exception ignored) {}
                }
                f = cache;
                try { writeSegmentMeta(cache, text, "custom"); } catch (Exception ignored) {}
            }
            if (hold) holdTtsReady(f);
            else playFile(f, false);
        } catch (Exception e) {
            final String msg = friendlyMessage(e);
            final String fb = fallback;
            final float sp = speed;
            notifySovits(false, msg);
            if (hold) holdTtsFailed(msg, fb, sp);
            else if (fb != null && !fb.trim().isEmpty()) ui.post(() -> speakInternal(fb, sp, 1.0f, true));
            else notifySpeechEnd();
        }
    }

    private void doSovits(final String payload) {
        new Thread(() -> {
            String fallback = "";
            float speed = 1.0f;
            boolean hold = false;
            try {
                JSONObject o = new JSONObject(payload == null ? "{}" : payload);
                final String text = o.optString("text", "").trim();
                fallback = o.optString("fallback", "");
                speed = (float) o.optDouble("speed", 1.0);
                if (text.isEmpty()) throw new IOException("朗读内容为空");
                String base = o.optString("url", "").trim();
                if (base.isEmpty()) throw new IOException("还没有填写 GPT-SoVITS 服务器地址");
                String ref = o.optString("refAudio", "").trim();
                if (ref.isEmpty()) throw new IOException("还没有填写参考音频路径");
                String prompt = o.optString("promptText", "");
                String promptLang = o.optString("promptLang", "zh");
                String textLang = o.optString("textLang", "zh");
                String split = o.optString("split", "cut5");
                hold = o.optBoolean("hold", false);
                String url = buildTtsUrl(base, text, ref, prompt, promptLang, textLang, split, speed);
                File f = downloadWav(url);
                writeSovitsMeta(f, text, "sovits", payload);
                if (hold) holdTtsReady(f);
                else playFile(f);
            } catch (Exception e) {
                final String msg = friendlyMessage(e);
                final String fb = fallback;
                final float sp = speed;
                notifySovits(false, msg);
                if (hold) holdTtsFailed(msg, fb, sp);
                else if (fb != null && !fb.trim().isEmpty()) {
                    ui.post(() -> speakInternal(fb, sp, 1.0f, true));
                }
            }
        }).start();
    }

    private static String shortText(String s, int n) {
        if (s == null) return "";
        s = s.replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }

    private static String friendlyMessage(Exception e) {
        if (e instanceof SocketTimeoutException) return "连接 GPT-SoVITS 超时";
        if (e instanceof ConnectException) return "连不上服务器，检查地址和网络";
        if (e instanceof UnknownHostException) return "找不到服务器地址";
        String m = e.getMessage();
        return (m == null || m.trim().isEmpty()) ? e.getClass().getSimpleName() : m;
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            try { in.close(); } catch (Exception ignored) {}
        }
    }

    private File fontFile() {
        return new File(new File(getFilesDir(), "fonts"), "custom.font");
    }

    private static String detectFontFormat(byte[] h) {
        if (h == null || h.length < 4) return null;
        int b0 = h[0] & 0xff, b1 = h[1] & 0xff, b2 = h[2] & 0xff, b3 = h[3] & 0xff;
        if (b0 == 0x00 && b1 == 0x01 && b2 == 0x00 && b3 == 0x00) return "truetype";
        if (h[0] == 'O' && h[1] == 'T' && h[2] == 'T' && h[3] == 'O') return "opentype";
        if (h[0] == 't' && h[1] == 'r' && h[2] == 'u' && h[3] == 'e') return "truetype";
        if (h[0] == 't' && h[1] == 'y' && h[2] == 'p' && h[3] == '1') return "truetype";
        if (h[0] == 'w' && h[1] == 'O' && h[2] == 'F' && h[3] == 'F') return "woff";
        if (h[0] == 'w' && h[1] == 'O' && h[2] == 'F' && h[3] == '2') return "woff2";
        if (h[0] == 't' && h[1] == 't' && h[2] == 'c' && h[3] == 'f') return "ttc";
        return null;
    }

    private static String detectFontFormat(File f) {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] h = new byte[4];
            if (in.read(h) < 4) return null;
            return detectFontFormat(h);
        } catch (Exception e) {
            return null;
        }
    }

    private static String fontMime(String fmt) {
        if ("opentype".equals(fmt)) return "font/otf";
        if ("woff".equals(fmt)) return "font/woff";
        if ("woff2".equals(fmt)) return "font/woff2";
        return "font/ttf";
    }

    private WebResourceResponse interceptFont(WebResourceRequest req) {
        try {
            Uri u = req.getUrl();
            if (u == null || !FONT_HOST.equals(u.getHost()) || !"/font".equals(u.getPath())) return null;
            File f = fontFile();
            if (!f.exists()) {
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            String fmt = detectFontFormat(f);
            if (fmt == null || "ttc".equals(fmt)) {
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            WebResourceResponse r = new WebResourceResponse(fontMime(fmt), null, new BufferedInputStream(new FileInputStream(f)));
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");
            r.setResponseHeaders(headers);
            return r;
        } catch (Exception e) {
            return null;
        }
    }

    private void importFont(final Uri uri, final String name) {
        new Thread(() -> {
            File dir = new File(getFilesDir(), "fonts");
            if (!dir.exists() && !dir.mkdirs()) {
                eval("window.__onFontError && window.__onFontError('无法创建字体目录');");
                return;
            }
            File tmp = new File(dir, "custom.tmp");
            String fmt;
            try {
                try (InputStream raw = getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(tmp)) {
                    if (raw == null) throw new IOException("无法读取字体文件");
                    DataInputStream in = new DataInputStream(new BufferedInputStream(raw));
                    byte[] head = new byte[4];
                    in.readFully(head);
                    fmt = detectFontFormat(head);
                    if (fmt == null) throw new IOException("不是有效的 TTF / OTF 字体文件");
                    if ("ttc".equals(fmt)) throw new IOException("暂不支持 TTC 字体集合，请用 TTF / OTF");
                    out.write(head);
                    byte[] buf = new byte[16384];
                    long total = 4;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        total += n;
                        if (total > MAX_FONT_BYTES) throw new IOException("字体文件太大（超过 64MB）");
                        out.write(buf, 0, n);
                    }
                    out.flush();
                    out.getFD().sync();
                    if (total < 128) throw new IOException("字体文件是空的");
                }
                File target = fontFile();
                if (target.exists() && !target.delete()) { /* ignore */ }
                if (!tmp.renameTo(target)) throw new IOException("保存字体失败");
                prefs.edit().putString("font_name", name == null ? "" : name).apply();
                String version = target.length() + "-" + target.lastModified();
                eval("window.__onFontPicked && window.__onFontPicked(" + JSONObject.quote(name == null ? "" : name)
                        + "," + JSONObject.quote(fmt) + "," + JSONObject.quote(version) + "," + target.length() + ");");
            } catch (Exception e) {
                if (tmp.exists()) tmp.delete();
                eval("window.__onFontError && window.__onFontError(" + JSONObject.quote(friendlyMessage(e)) + ");");
            }
        }).start();
    }

    private String fontInfoJson() {
        try {
            File f = fontFile();
            if (!f.exists()) return "{\"exists\":false}";
            String fmt = detectFontFormat(f);
            if (fmt == null || "ttc".equals(fmt)) return "{\"exists\":false}";
            JSONObject o = new JSONObject();
            o.put("exists", true);
            o.put("format", fmt);
            o.put("size", f.length());
            o.put("version", f.length() + "-" + f.lastModified());
            o.put("name", prefs.getString("font_name", ""));
            return o.toString();
        } catch (Exception e) {
            return "{\"exists\":false}";
        }
    }

    private void cleanupTtsDir(File dir, long maxAge, long now) {
        if (dir == null || !dir.exists()) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) cleanupTtsDir(f, maxAge, now);
            else {
                String n = f.getName().toLowerCase(java.util.Locale.ROOT);
                if ((n.endsWith(".mp3") || n.endsWith(".wav") || n.endsWith(".m4a"))
                        && now - f.lastModified() > maxAge) f.delete();
                else if (n.endsWith(".json") && now - f.lastModified() > maxAge) f.delete();
            }
        }
    }

    private String llmEndpoint(String provider, String raw) throws IOException {
        String u = raw == null ? "" : raw.trim();
        if (u.isEmpty()) throw new IOException("还没有填写 API 地址");
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        if ("claude".equals(provider)){
            if (!u.endsWith("/messages")) u += "/messages";
        } else {
            if (!u.endsWith("/chat/completions")) u += "/chat/completions";
        }
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        return u;
    }

    private String httpPostJson(String endpoint, String key, String authHeader, String body, String extraHeader, String extraValue) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(15000);
            c.setReadTimeout(90000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Accept", "application/json");
            if (key != null && !key.isEmpty()){
                if ("x-api-key".equals(authHeader)) c.setRequestProperty("x-api-key", key);
                else c.setRequestProperty("Authorization", "Bearer " + key);
            }
            if (extraHeader != null) c.setRequestProperty(extraHeader, extraValue);
            try (OutputStream out = c.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
            int code = c.getResponseCode();
            InputStream in = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
            String text = in == null ? "" : new String(readAll(in), StandardCharsets.UTF_8);
            if (code < 200 || code >= 300){
                String msg = text;
                try { msg = new JSONObject(text).optString("error", text); } catch (Exception ignored) {}
                throw new IOException("服务器返回 " + code + (msg.isEmpty() ? "" : "：" + shortText(msg, 200)));
            }
            return text;
        } finally { c.disconnect(); }
    }

    private void llmChatTask(String payload) {
        try {
            JSONObject o = new JSONObject(payload == null ? "{}" : payload);
            String provider = o.optString("provider", "openai");
            String url = o.optString("url", "");
            String key = o.optString("key", "");
            String model = o.optString("model", "");
            String system = o.optString("system", "");
            String user = o.optString("user", "");
            double temperature = o.optDouble("temperature", 0.6);
            if (user.trim().isEmpty()) throw new IOException("请输入要改写的内容");
            if (user.length() > 1200) throw new IOException("输入不能超过 1200 字");
            String endpoint = llmEndpoint(provider, url);
            String result;
            if ("claude".equals(provider)){
                JSONArray msgs = new JSONArray();
                JSONObject m = new JSONObject();
                m.put("role", "user");
                m.put("content", user);
                msgs.put(m);
                JSONObject b = new JSONObject();
                b.put("model", model == null || model.trim().isEmpty() ? "claude-3-5-sonnet-latest" : model.trim());
                b.put("max_tokens", 1200);
                b.put("temperature", temperature);
                b.put("system", system);
                b.put("messages", msgs);
                String resp = httpPostJson(endpoint, key, "x-api-key", b.toString(), "anthropic-version", "2023-06-01");
                JSONObject j = new JSONObject(resp);
                JSONArray content = j.optJSONArray("content");
                if (content == null || content.length() == 0) throw new IOException("Claude 返回里没有文本");
                result = content.getJSONObject(0).optString("text", "");
            } else {
                JSONArray msgs = new JSONArray();
                JSONObject sys = new JSONObject(); sys.put("role", "system"); sys.put("content", system); msgs.put(sys);
                JSONObject usr = new JSONObject(); usr.put("role", "user"); usr.put("content", user); msgs.put(usr);
                JSONObject b = new JSONObject();
                b.put("model", model == null || model.trim().isEmpty() ? "gpt-4o-mini" : model.trim());
                b.put("messages", msgs);
                b.put("temperature", temperature);
                b.put("max_tokens", 1200);
                String resp = httpPostJson(endpoint, key, "bearer", b.toString(), null, null);
                JSONObject j = new JSONObject(resp);
                JSONArray choices = j.optJSONArray("choices");
                if (choices == null || choices.length() == 0) throw new IOException("接口返回里没有文本");
                result = choices.getJSONObject(0).getJSONObject("message").optString("content", "");
            }
            result = result == null ? "" : result.trim();
            eval("window.__onAiTransResult&&window.__onAiTransResult(true," + JSONObject.quote(result) + ");");
        } catch (Exception e) {
            eval("window.__onAiTransResult&&window.__onAiTransResult(false," + JSONObject.quote(friendlyMessage(e)) + ");");
        }
    }

    private void cleanupTtsCache() {
        new Thread(() -> {
            try {
                File[] files = getCacheDir().listFiles();
                if (files == null) return;
                long now = System.currentTimeMillis();
                cleanupTtsDir(new File(getFilesDir(), "tts_cache_system"), SYSTEM_TTS_CACHE_MS, now);
                for (File f : files) {
                    long age = now - f.lastModified();
                    String n = f.getName();
                    if (n.startsWith("tts_") && age > SYSTEM_TTS_CACHE_MS) f.delete();
                }
            } catch (Exception ignored) {}
        }).start();
    }

    private static String normalizeBase(String s) throws IOException {
        s = s == null ? "" : s.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (s.isEmpty()) throw new IOException("还没有填写服务器地址");
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "http://" + s;
        return s;
    }

    private static String audioMime(String name) {
        String n = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".m4a") || n.endsWith(".mp4")) return "audio/mp4";
        if (n.endsWith(".ogg") || n.endsWith(".opus")) return "audio/ogg";
        if (n.endsWith(".flac")) return "audio/flac";
        if (n.endsWith(".aac")) return "audio/aac";
        if (n.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private static String safeFileName(String name) {
        if (name == null || name.trim().isEmpty()) name = "ref.wav";
        return name.replace("\"", "").replace("\r", "").replace("\n", "");
    }

    private static String extensionOf(String name) {
        if (name == null) return "bin";
        int i = name.lastIndexOf('.');
        if (i < 0 || i == name.length() - 1) return "bin";
        String e = name.substring(i + 1).toLowerCase(Locale.ROOT);
        if (!e.matches("[a-z0-9]{1,8}")) return "bin";
        return e;
    }

    private String readLimited(InputStream in, int max) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            bos.write(buf, 0, n);
            if (bos.size() > max) throw new IOException("服务器返回内容过大");
        }
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String serverMessage(String body) {
        try {
            JSONObject o = new JSONObject(body);
            if (o.has("message")) return o.optString("message");
            if (o.has("detail")) return o.optString("detail");
            if (o.has("error")) return o.optString("error");
        } catch (Exception ignored) {}
        return shortText(body, 180);
    }

    private void copyAudio(final Uri uri, final String name) {
        new Thread(() -> {
            File dir = new File(getFilesDir(), "voices");
            if (!dir.exists() && !dir.mkdirs()) {
                eval("window.__onAudioError && window.__onAudioError('无法创建音频目录');");
                return;
            }
            String ext = extensionOf(name);
            File out = new File(dir, "ref_" + System.currentTimeMillis() + "." + ext);
            try (InputStream in = getContentResolver().openInputStream(uri);
                 FileOutputStream os = new FileOutputStream(out)) {
                if (in == null) throw new IOException("无法读取音频文件");
                byte[] buf = new byte[16384];
                long total = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > MAX_AUDIO_BYTES) throw new IOException("音频文件太大（超过 30MB）");
                    os.write(buf, 0, n);
                }
                os.flush();
                os.getFD().sync();
                if (total < 1024) throw new IOException("音频文件太小或为空");
                eval("window.__onAudioPicked && window.__onAudioPicked(" + JSONObject.quote(out.getAbsolutePath())
                        + "," + JSONObject.quote(name == null ? "参考音频" : name) + ");");
            } catch (Exception e) {
                if (out.exists()) out.delete();
                eval("window.__onAudioError && window.__onAudioError(" + JSONObject.quote(friendlyMessage(e)) + ");");
            }
        }).start();
    }

    private void writeFormField(OutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeFormFile(OutputStream out, String boundary, String field, String fileName, File file) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + field + "\"; filename=\"" + safeFileName(fileName) + "\"\r\n")
                .getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + audioMime(fileName) + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void uploadVoice(String payload) {
        new Thread(() -> {
            String clientId = "";
            try {
                JSONObject o = new JSONObject(payload == null ? "{}" : payload);
                clientId = o.optString("clientId", "");
                String base = normalizeBase(o.optString("url", ""));
                String key = o.optString("key", "");
                String audioPath = o.optString("audioPath", "");
                String fileName = o.optString("fileName", "ref.wav");
                File audio = new File(audioPath);
                if (!audio.isFile()) throw new IOException("找不到本地参考音频");
                String boundary = "----Wheel" + System.currentTimeMillis();
                HttpURLConnection c = (HttpURLConnection) new URL(base + "/voices").openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(10000);
                c.setReadTimeout(120000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                if (!key.isEmpty()) c.setRequestProperty("X-API-Key", key);
                try (OutputStream out = c.getOutputStream()) {
                    writeFormField(out, boundary, "name", o.optString("name", ""));
                    writeFormField(out, boundary, "prompt_text", o.optString("promptText", ""));
                    writeFormField(out, boundary, "prompt_lang", o.optString("promptLang", "zh"));
                    writeFormField(out, boundary, "text_lang", o.optString("textLang", "zh"));
                    writeFormFile(out, boundary, "audio", fileName, audio);
                    out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                }
                int code = c.getResponseCode();
                InputStream in = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                String body = in == null ? "" : readLimited(in, 1024 * 1024);
                c.disconnect();
                if (code >= 200 && code < 300) {
                    eval("window.__onVoiceUploaded && window.__onVoiceUploaded(true," + JSONObject.quote(clientId)
                            + "," + JSONObject.quote(body) + ",\"\");");
                } else {
                    eval("window.__onVoiceUploaded && window.__onVoiceUploaded(false," + JSONObject.quote(clientId)
                            + ",\"\", " + JSONObject.quote(serverMessage(body)) + ");");
                }
            } catch (Exception e) {
                eval("window.__onVoiceUploaded && window.__onVoiceUploaded(false," + JSONObject.quote(clientId)
                        + ",\"\", " + JSONObject.quote(friendlyMessage(e)) + ");");
            }
        }).start();
    }

    private void deleteVoice(String payload) {
        new Thread(() -> {
            String clientId = "";
            try {
                JSONObject o = new JSONObject(payload == null ? "{}" : payload);
                clientId = o.optString("clientId", "");
                String base = normalizeBase(o.optString("url", ""));
                String key = o.optString("key", "");
                String voiceId = o.optString("voiceId", "");
                if (voiceId.isEmpty()) throw new IOException("音色 ID 为空");
                HttpURLConnection c = (HttpURLConnection) new URL(base + "/voices/" + Uri.encode(voiceId)).openConnection();
                c.setRequestMethod("DELETE");
                c.setConnectTimeout(8000);
                c.setReadTimeout(15000);
                if (!key.isEmpty()) c.setRequestProperty("X-API-Key", key);
                int code = c.getResponseCode();
                InputStream in = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                String body = in == null ? "" : readLimited(in, 256 * 1024);
                c.disconnect();
                if (code >= 200 && code < 300) {
                    eval("window.__onVoiceDeleted && window.__onVoiceDeleted(true," + JSONObject.quote(clientId) + ",\"\");");
                } else {
                    eval("window.__onVoiceDeleted && window.__onVoiceDeleted(false," + JSONObject.quote(clientId)
                            + "," + JSONObject.quote(serverMessage(body)) + ");");
                }
            } catch (Exception e) {
                eval("window.__onVoiceDeleted && window.__onVoiceDeleted(false," + JSONObject.quote(clientId)
                        + "," + JSONObject.quote(friendlyMessage(e)) + ");");
            }
        }).start();
    }

    private void testCloneServer(String payload) {
        new Thread(() -> {
            try {
                JSONObject o = new JSONObject(payload == null ? "{}" : payload);
                String base = normalizeBase(o.optString("url", ""));
                String key = o.optString("key", "");
                HttpURLConnection c = (HttpURLConnection) new URL(base + "/health").openConnection();
                c.setRequestMethod("GET");
                c.setConnectTimeout(8000);
                c.setReadTimeout(10000);
                if (!key.isEmpty()) c.setRequestProperty("X-API-Key", key);
                int code = c.getResponseCode();
                InputStream in = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
                String body = in == null ? "" : readLimited(in, 256 * 1024);
                c.disconnect();
                final boolean ok = code >= 200 && code < 300;
                eval("window.__onCloneHealth && window.__onCloneHealth(" + ok + "," + JSONObject.quote(body)
                        + "," + JSONObject.quote(ok ? "" : serverMessage(body)) + ");");
            } catch (Exception e) {
                eval("window.__onCloneHealth && window.__onCloneHealth(false,\"\","
                        + JSONObject.quote(friendlyMessage(e)) + ");");
            }
        }).start();
    }

    private void cloneSpeak(String payload) {
        new Thread(() -> {
            String fallback = "";
            float speed = 1.0f;
            boolean hold = false;
            try {
                JSONObject o = new JSONObject(payload == null ? "{}" : payload);
                final String text = o.optString("text", "").trim();
                fallback = o.optString("fallback", "");
                speed = (float) o.optDouble("speed", 1.0);
                if (text.isEmpty()) throw new IOException("朗读内容为空");
                String base = normalizeBase(o.optString("url", ""));
                String key = o.optString("key", "");
                String voiceId = o.optString("voiceId", "");
                hold = o.optBoolean("hold", false);
                if (voiceId.isEmpty()) throw new IOException("还没有选择音色");
                Uri.Builder ub = Uri.parse(base + "/tts").buildUpon();
                ub.appendQueryParameter("text", text);
                ub.appendQueryParameter("voice_id", voiceId);
                ub.appendQueryParameter("speed_factor", String.valueOf(speed));
                File f = downloadAudio(ub.build().toString(), key);
                writeSovitsMeta(f, text, "clone", payload);
                if (hold) holdTtsReady(f);
                else playFile(f);
            } catch (Exception e) {
                final String msg = friendlyMessage(e);
                final String fb = fallback;
                final float sp = speed;
                notifySovits(false, msg);
                if (hold) holdTtsFailed(msg, fb, sp);
                else if (fb != null && !fb.trim().isEmpty()) {
                    ui.post(() -> speakInternal(fb, sp, 1.0f, true));
                }
            }
        }).start();
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) {
                    String name = c.getString(i);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {}
        String last = uri.getLastPathSegment();
        return last == null ? "导入文件" : last;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_TTS_REPLACE) {
            final String target = pendingTtsReplacePath;
            pendingTtsReplacePath = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || target == null){
                eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(false,'已取消');");
                return;
            }
            final Uri uri = data.getData();
            new Thread(() -> {
                try {
                    File dst = ttsFileForPath(target);
                    if (dst == null) throw new IOException("文件路径无效");
                    try (InputStream in = getContentResolver().openInputStream(uri);
                         FileOutputStream out = new FileOutputStream(dst)) {
                        if (in == null) throw new IOException("无法读取音频");
                        byte[] buf = new byte[16384];
                        int n; long total = 0;
                        while ((n = in.read(buf)) > 0) {
                            total += n;
                            if (total > MAX_AUDIO_BYTES) throw new IOException("音频超过 30MB");
                            out.write(buf, 0, n);
                        }
                        out.flush();
                        out.getFD().sync();
                    }
                    dst.setLastModified(System.currentTimeMillis());
                    eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(true,'已替换音频');");
                } catch (Exception e) {
                    eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(false," + JSONObject.quote(friendlyMessage(e)) + ");");
                }
            }).start();
            return;
        }
        if (requestCode == REQ_IMPORT) {
            if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
            final Uri uri = data.getData();
            final String name = displayName(uri);
            new Thread(() -> {
                try {
                    byte[] bytes = readAll(getContentResolver().openInputStream(uri));
                    String json = PwhDecoder.decode(bytes);
                    eval("window.__onImportFile(" + JSONObject.quote(name) + "," + JSONObject.quote(json) + ");");
                } catch (Exception e) {
                    eval("window.__onImportError(" + JSONObject.quote(shortText(friendlyMessage(e), 200)) + ");");
                }
            }).start();
            return;
        }
        if (requestCode == REQ_AUDIO) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                copyAudio(uri, displayName(uri));
            }
            return;
        }
        if (requestCode == REQ_FONT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                importFont(uri, displayName(uri));
            }
            return;
        }
        if (requestCode == REQ_EXPORT) {
            final byte[] bytes = pendingExportBytes;
            pendingExportBytes = null;
            pendingExportMime = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) {
                eval("window.__onExportResult&&window.__onExportResult(false);");
                return;
            }
            final Uri uri = data.getData();
            new Thread(() -> {
                boolean ok = false;
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out != null) {
                        out.write(bytes);
                        out.flush();
                        ok = true;
                    }
                } catch (Exception ignored) {}
                final boolean result = ok;
                eval("window.__onExportResult&&window.__onExportResult(" + result + ");");
            }).start();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION) {
            String cb = pendingLocationCb;
            pendingLocationCb = null;
            if (cb == null) return;
            if (hasLocationPermission()) doGetLocation(cb);
            else notifyLocation(cb, false, "", "", 0, 0, "", "没有定位权限");
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocation(String cb) {
        if (cb == null || cb.isEmpty()) return;
        if (locationRequesting) {
            notifyLocation(cb, false, "", "", 0, 0, "", "正在定位，请稍后再试");
            return;
        }
        if (!hasLocationPermission()) {
            pendingLocationCb = cb;
            try {
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            } catch (Exception e) {
                pendingLocationCb = null;
                notifyLocation(cb, false, "", "", 0, 0, "", "无法申请定位权限");
            }
            return;
        }
        doGetLocation(cb);
    }

    private void doGetLocation(final String cb) {
        locationRequesting = true;
        LocationManager lm;
        try {
            lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        } catch (Exception e) {
            lm = null;
        }
        if (lm == null) {
            locationRequesting = false;
            notifyLocation(cb, false, "", "", 0, 0, "", "系统没有定位服务");
            return;
        }
        Location best = null;
        for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (!lm.isProviderEnabled(p)) continue;
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (Exception ignored) {}
        }
        if (best != null) {
            finishLocation(cb, best);
            return;
        }
        final LocationManager manager = lm;
        final boolean[] finished = new boolean[]{false};
        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if (finished[0]) return;
                finished[0] = true;
                try { manager.removeUpdates(this); } catch (Exception ignored) {}
                finishLocation(cb, location);
            }
            @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
        };
        ui.postDelayed(() -> {
            if (finished[0]) return;
            finished[0] = true;
            try { manager.removeUpdates(listener); } catch (Exception ignored) {}
            finishLocation(cb, null);
        }, 9000);
        boolean requested = false;
        for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (!manager.isProviderEnabled(p)) continue;
                manager.requestLocationUpdates(p, 0, 0, listener, Looper.getMainLooper());
                requested = true;
            } catch (Exception ignored) {}
        }
        if (!requested) {
            finished[0] = true;
            finishLocation(cb, null);
        }
    }

    private void finishLocation(final String cb, final Location loc) {
        if (loc == null) {
            locationRequesting = false;
            notifyLocation(cb, false, "", "", 0, 0, "", "没有获取到定位，请到室外或打开定位服务");
            return;
        }
        new Thread(() -> {
            String[] city = reverseCity(loc.getLatitude(), loc.getLongitude());
            locationRequesting = false;
            notifyLocation(cb, true, city[0], city[1], loc.getLatitude(), loc.getLongitude(), loc.getProvider(), "");
        }).start();
    }

    private String[] reverseCity(double lat, double lng) {
        String city = "";
        String province = "";
        try {
            Geocoder geocoder = new Geocoder(this, Locale.CHINA);
            List<Address> list = geocoder.getFromLocation(lat, lng, 1);
            if (list != null && !list.isEmpty()) {
                Address a = list.get(0);
                province = nz(a.getAdminArea());
                city = nz(a.getLocality());
                if (city.isEmpty()) city = nz(a.getSubAdminArea());
                if (city.isEmpty()) city = nz(a.getAdminArea());
                if (city.isEmpty()) city = nz(a.getSubLocality());
            }
        } catch (Exception ignored) {}
        if (city.isEmpty()) {
            try {
                String u = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lng + "&zoom=10&accept-language=zh-CN";
                HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
                c.setConnectTimeout(4000);
                c.setReadTimeout(5000);
                c.setRequestProperty("User-Agent", "YunhaiWheel/1.2.3 (Android)");
                try {
                    if (c.getResponseCode() == 200) {
                        JSONObject root = new JSONObject(new String(readAll(c.getInputStream()), StandardCharsets.UTF_8));
                        JSONObject addr = root.optJSONObject("address");
                        if (addr != null) {
                            city = firstNonEmpty(addr.optString("city"), addr.optString("town"), addr.optString("county"), addr.optString("state"));
                            if (province.isEmpty()) province = addr.optString("state");
                        }
                    }
                } finally {
                    try { c.disconnect(); } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
        }
        return new String[]{city, province};
    }

    private static String nz(String s) { return s == null ? "" : s.trim(); }

    private static String firstNonEmpty(String... values) {
        for (String v : values) if (v != null && !v.trim().isEmpty()) return v.trim();
        return "";
    }

    private void notifyLocation(String cb, boolean ok, String city, String province, double lat, double lng, String provider, String error) {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", ok);
            o.put("city", city == null ? "" : city);
            o.put("province", province == null ? "" : province);
            o.put("lat", lat);
            o.put("lng", lng);
            o.put("provider", provider == null ? "" : provider);
            o.put("error", error == null ? "" : error);
            eval("window.__onLocation&&window.__onLocation(" + JSONObject.quote(cb) + "," + JSONObject.quote(o.toString()) + ");");
        } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(window.__handleBack?window.__handleBack():'exit')", value -> {
            if (isFinishing() || isDestroyed()) return;
            if (value == null || value.equals("null") || value.contains("exit")) finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        cleanupTtsCache();
        try { if (tts != null) tts.stop(); } catch (Exception ignored) {}
        stopPlayer();
    }

    @Override
    protected void onDestroy() {
        try { if (tts != null) { tts.stop(); tts.shutdown(); } } catch (Exception ignored) {}
        tts = null;
        stopPlayer();
        if (web != null) {
            try { web.removeJavascriptInterface("Android"); } catch (Exception ignored) {}
            try { web.destroy(); } catch (Exception ignored) {}
            web = null;
        }
        super.onDestroy();
    }

    private final class Bridge {

        @JavascriptInterface
        public String platform() { return "android"; }

        @JavascriptInterface
        public boolean isChineseLocale() { return "zh".equals(Locale.getDefault().getLanguage()); }

        @JavascriptInterface
        public String appVersion() { return "0.2.8.10"; }

        @JavascriptInterface
        public String loadData() {
            try {
                synchronized (dbLock) {
                    if (!dbFile.exists()) return "";
                    try (FileInputStream in = new FileInputStream(dbFile)) {
                        return new String(readAll(in), StandardCharsets.UTF_8);
                    }
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void saveData(String json) {
            if (json == null) return;
            synchronized (dbLock) {
                File tmp = new File(getFilesDir(), "wheels.json.tmp");
                try {
                    try (FileOutputStream out = new FileOutputStream(tmp)) {
                        out.write(json.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                        out.getFD().sync();
                    }
                    if (dbFile.exists() && !dbFile.delete()) { /* ignore */ }
                    if (!tmp.renameTo(dbFile)) {
                        try (FileOutputStream out = new FileOutputStream(dbFile)) {
                            out.write(json.getBytes(StandardCharsets.UTF_8));
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public void toast(final String msg) {
            ui.post(() -> {
                try { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show(); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            ui.post(() -> {
                try {
                    Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (v == null || !v.hasVibrator()) return;
                    int d = Math.max(5, Math.min(80, ms));
                    if (Build.VERSION.SDK_INT >= 26) {
                        v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(d);
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void pickWheelFile() {
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "application/octet-stream", "application/zip", "application/gzip",
                            "application/json", "text/plain", "application/x-zip-compressed", "*/*"
                    });
                    startActivityForResult(i, REQ_IMPORT);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "没有可用的文件选择器", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void exportFile(String name, String text) {
            exportPackage(name, "json", text);
        }

        @JavascriptInterface
        public void exportPackage(String name, String kind, String payload) {
            final String k = kind == null ? "json" : kind;
            final String n = (name == null || name.trim().isEmpty()) ? "转盘备份.json" : name;
            final byte[] bytes;
            final String mime;
            try {
                if ("pwh".equals(k)) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    bos.write("pwh".getBytes(StandardCharsets.US_ASCII));
                    try (GZIPOutputStream gz = new GZIPOutputStream(bos)) {
                        gz.write(payload == null ? new byte[0] : payload.getBytes(StandardCharsets.UTF_8));
                    }
                    bytes = bos.toByteArray();
                    mime = "application/octet-stream";
                } else if ("zip".equals(k)) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    try (ZipOutputStream zos = new ZipOutputStream(bos)) {
                        ZipEntry e = new ZipEntry("data.json");
                        e.setTime(System.currentTimeMillis());
                        zos.putNextEntry(e);
                        zos.write(payload == null ? new byte[0] : payload.getBytes(StandardCharsets.UTF_8));
                        zos.closeEntry();
                        ZipEntry r = new ZipEntry("README.txt");
                        zos.putNextEntry(r);
                        zos.write("云海转盘 完整版 2.0\n可用云海转盘「导入」直接读取。\n".getBytes(StandardCharsets.UTF_8));
                        zos.closeEntry();
                    }
                    bytes = bos.toByteArray();
                    mime = "application/zip";
                } else {
                    bytes = (payload == null ? "" : payload).getBytes(StandardCharsets.UTF_8);
                    mime = "application/json";
                }
            } catch (Exception e) {
                eval("window.__onExportResult&&window.__onExportResult(false);");
                return;
            }
            pendingExportBytes = bytes;
            pendingExportMime = mime;
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_TITLE, n);
                    startActivityForResult(i, REQ_EXPORT);
                } catch (Exception e) {
                    pendingExportBytes = null;
                    pendingExportMime = null;
                    eval("window.__onExportResult&&window.__onExportResult(false);");
                }
            });
        }

        @JavascriptInterface
        public void resetHeldTts() { holdTtsReset(); }

        @JavascriptInterface
        public void playHeldTts() { ui.post(() -> playHeldTtsNow()); }

        @JavascriptInterface
        public void speakCustomSegments(String payload) {
            new Thread(() -> speakCustomSegmentsTask(payload)).start();
        }

        @JavascriptInterface
        public String listTtsFiles() {
            JSONArray arr = new JSONArray();
            try {
                java.util.List<File> files = new java.util.ArrayList<>();
                File cache = getCacheDir();
                File[] all = cache == null ? null : cache.listFiles();
                if (all != null) {
                    for (File f : all) {
                        if (f.isFile()) {
                            String n = f.getName();
                            if ((n.startsWith("custom_tts_") || n.startsWith("sovits_")) && !n.startsWith("sovits_tmp_")) files.add(f);
                        }
                    }
                }
                collectTtsFiles(new File(getFilesDir(), "tts_cache"), files, 0);
                collectTtsFiles(new File(getFilesDir(), "tts_cache_system"), files, 0);
                for (File f : files) {
                    JSONObject o = new JSONObject();
                    o.put("path", f.getAbsolutePath());
                    o.put("name", f.getName());
                    o.put("size", f.length());
                    o.put("at", f.lastModified());
                    o.put("kind", ttsKind(f));
                    String text = "";
                    File meta = new File(f.getParentFile(), f.getName() + ".json");
                    if (meta.exists()) {
                        try (FileInputStream in = new FileInputStream(meta)) {
                            JSONObject m = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
                            text = m.optString("text", "");
                        } catch (Exception ignored) {}
                    }
                    o.put("text", text);
                    arr.put(o);
                }
            } catch (Exception ignored) {}
            return arr.toString();
        }

        @JavascriptInterface
        public void playTtsFile(String path) {
            try {
                File f = ttsFileForPath(path);
                if (f == null || !f.exists()) { toast("音频文件不存在"); return; }
                try { if (tts != null) tts.stop(); } catch (Exception ignored) {}
                stopPlayer();
                playFile(f, false);
            } catch (Exception e) { toast("无法播放"); }
        }

        @JavascriptInterface
        public void deleteTtsFile(String path) {
            try {
                File f = ttsFileForPath(path);
                boolean ok = false;
                if (f != null && f.exists()) {
                    ok = f.delete();
                    File meta = new File(f.getParentFile(), f.getName() + ".json");
                    if (meta.exists()) meta.delete();
                }
                eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(" + ok + "," + JSONObject.quote(ok ? "已删除" : "删除失败") + ");");
            } catch (Exception e) {
                eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(false,'删除失败');");
            }
        }

        @JavascriptInterface
        public void pickTtsFileForReplace(String path) {
            try {
                File f = ttsFileForPath(path);
                if (f == null || !f.exists()) { toast("音频文件不存在"); return; }
                pendingTtsReplacePath = f.getAbsolutePath();
                ui.post(() -> {
                    try {
                        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("audio/*");
                        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/*", "audio/mpeg", "audio/wav", "audio/x-wav"});
                        startActivityForResult(i, REQ_TTS_REPLACE);
                    } catch (Exception e) {
                        pendingTtsReplacePath = null;
                        eval("window.__onTtsFileChanged&&window.__onTtsFileChanged(false,'没有可用的文件选择器');");
                    }
                });
            } catch (Exception e) { toast("无法打开文件选择器"); }
        }

        @JavascriptInterface
        public void exportTtsFiles(String pathsJson) {
            new Thread(() -> {
                try {
                    JSONArray arr = new JSONArray(pathsJson == null ? "[]" : pathsJson);
                    java.util.List<File> files = new java.util.ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        File f = ttsFileForPath(arr.optString(i, ""));
                        if (f != null && f.isFile()) files.add(f);
                    }
                    if (files.isEmpty()) { eval("window.__onTtsCacheEmpty&&window.__onTtsCacheEmpty();"); return; }
                    exportTtsCacheZip(files);
                } catch (Exception e) {
                    eval("window.__onExportResult&&window.__onExportResult(false);");
                }
            }).start();
        }

        @JavascriptInterface
        public void speakSystemSegments(String payload) {
            new Thread(() -> speakSystemSegmentsTask(payload)).start();
        }

        @JavascriptInterface
        public void speakSystemCached(String payload) {
            new Thread(() -> speakSystemCachedTask(payload)).start();
        }

        @JavascriptInterface
        public void regenerateTtsFile(String path, String configJson) {
            new Thread(() -> regenerateTtsFileTask(path, configJson)).start();
        }

        @JavascriptInterface
        public void llmChat(String payload) {
            new Thread(() -> llmChatTask(payload)).start();
        }

        @JavascriptInterface
        public void customTts(String payload) {
            new Thread(() -> customTtsTask(payload)).start();
        }

        @JavascriptInterface
        public String listTtsCache() {
            JSONArray arr = new JSONArray();
            try {
                File[] all = getCacheDir().listFiles();
                if (all != null) {
                    for (File f : all) {
                        if (!f.isFile()) continue;
                        String n = f.getName();
                        if (!n.startsWith("sovits_") && !n.startsWith("custom_tts_") && !n.startsWith("tts_")) continue;
                        JSONObject o = new JSONObject();
                        o.put("name", n);
                        o.put("size", f.length());
                        o.put("at", f.lastModified());
                        o.put("kind", n.startsWith("sovits_") ? "sovits" : "custom");
                        arr.put(o);
                    }
                }
            } catch (Exception ignored) {}
            return arr.toString();
        }

        @JavascriptInterface
        public void exportTtsCacheSelected(String namesJson) {
            new Thread(() -> {
                try {
                    JSONArray arr = new JSONArray(namesJson == null ? "[]" : namesJson);
                    File dir = getCacheDir();
                    java.util.List<File> files = new java.util.ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        String n = arr.optString(i, "");
                        if (n.isEmpty() || n.indexOf('/') >= 0 || n.indexOf('\\') >= 0) continue;
                        if (!n.startsWith("sovits_") && !n.startsWith("custom_tts_") && !n.startsWith("tts_")) continue;
                        File f = new File(dir, n);
                        if (f.isFile()) files.add(f);
                    }
                    exportTtsCacheZip(files);
                } catch (Exception e) {
                    eval("window.__onExportResult&&window.__onExportResult(false);");
                }
            }).start();
        }

        @JavascriptInterface
        public void exportTtsCache() {
            new Thread(() -> {
                File[] all = getCacheDir().listFiles();
                java.util.List<File> files = new java.util.ArrayList<>();
                if (all != null) {
                    for (File f : all) {
                        if (!f.isFile()) continue;
                        String n = f.getName();
                        if (n.startsWith("sovits_") || n.startsWith("custom_tts_") || n.startsWith("tts_")) files.add(f);
                    }
                }
                exportTtsCacheZip(files);
            }).start();
        }

        @JavascriptInterface
        public void speak(String text, double rate, double pitch) {
            ui.post(() -> speakInternal(text, (float) rate, (float) pitch, true));
        }

        @JavascriptInterface
        public void stopSpeaking() {
            ui.post(() -> {
                try { if (tts != null) tts.stop(); } catch (Exception ignored) {}
                stopPlayer();
            });
        }

        @JavascriptInterface
        public void openTtsSettings() {
            ui.post(() -> {
                try {
                    startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
                } catch (Exception e) {
                    try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public String getBuiltinVoicePath(String id) {
            try {
                String file;
                String name;
                if ("claude".equals(id)){ file = "tts_samples/claude_sonnet_5_5.mp3"; name = "Claude sonnet 5.5.mp3"; }
                else if ("gpt6".equals(id)){ file = "tts_samples/gpt6_1sol.mp3"; name = "GPT6.1sol.mp3"; }
                else return "";
                File dir = new File(getFilesDir(), "tts_voices");
                if (!dir.exists() && !dir.mkdirs()) return "";
                File out = new File(dir, "builtin_" + id + ".mp3");
                if (out.exists() && out.length() > 1024) return out.getAbsolutePath();
                try (InputStream in = getAssets().open(file); FileOutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    os.flush();
                    os.getFD().sync();
                }
                return out.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String persistTtsVoice(String path, String name) {
            try {
                if (path == null || path.trim().isEmpty()) return "";
                File src = new File(path.trim());
                String root = getFilesDir().getCanonicalPath();
                String canonical = src.getCanonicalPath();
                if (!canonical.startsWith(root + File.separator)) return "";
                if (!src.exists() || src.length() < 1024) return "";
                if (src.length() > MAX_AUDIO_BYTES) return "";
                File dir = new File(getFilesDir(), "tts_voices");
                if (!dir.exists() && !dir.mkdirs()) return "";
                String ext = extensionOf(name);
                if ("bin".equals(ext)) ext = extensionOf(path);
                File tmp = new File(dir, "uploading_" + System.nanoTime() + ".tmp");
                File out = new File(dir, "tts_ref_" + System.currentTimeMillis() + "." + ext);
                try (FileInputStream in = new FileInputStream(src);
                     FileOutputStream os = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    os.flush();
                    os.getFD().sync();
                }
                File[] olds = dir.listFiles();
                if (olds != null) {
                    for (File f : olds) {
                        if (f.getName().startsWith("tts_ref_")) f.delete();
                    }
                }
                if (!tmp.renameTo(out)) {
                    tmp.delete();
                    return "";
                }
                return out.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void pickAudio() {
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("audio/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "audio/*", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4",
                            "audio/aac", "audio/ogg", "audio/flac", "application/octet-stream"
                    });
                    try {
                        Uri initial = DocumentsContract.buildDocumentUri(
                                "com.android.externalstorage.documents", "primary:");
                        i.putExtra("android.provider.extra.INITIAL_URI", initial);
                    } catch (Exception ignored) {}
                    startActivityForResult(i, REQ_AUDIO);
                } catch (Exception e) {
                    eval("window.__onAudioError && window.__onAudioError('没有可用的文件选择器');");
                }
            });
        }

        @JavascriptInterface
        public void deleteAudio(String path) {
            try {
                File dir = new File(getFilesDir(), "voices");
                String base = dir.getCanonicalPath() + File.separator;
                File f = new File(path == null ? "" : path);
                if (f.getCanonicalPath().startsWith(base) && f.isFile()) f.delete();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void uploadVoice(String payload) {
            MainActivity.this.uploadVoice(payload);
        }

        @JavascriptInterface
        public void deleteVoice(String payload) {
            MainActivity.this.deleteVoice(payload);
        }

        @JavascriptInterface
        public void testCloneServer(String payload) {
            MainActivity.this.testCloneServer(payload);
        }

        @JavascriptInterface
        public void cloneSpeak(String payload) {
            MainActivity.this.cloneSpeak(payload);
        }

        @JavascriptInterface
        public void openUrl(String url) {
            ui.post(() -> {
                try {
                    String u = url == null ? "" : url.trim();
                    if (!u.startsWith("http://") && !u.startsWith("https://")) throw new IllegalArgumentException();
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开链接", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void pickFont() {
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    try {
                        Uri initial = DocumentsContract.buildDocumentUri(
                                "com.android.externalstorage.documents", "primary:");
                        i.putExtra("android.provider.extra.INITIAL_URI", initial);
                    } catch (Exception ignored) {}
                    startActivityForResult(i, REQ_FONT);
                } catch (Exception e) {
                    try {
                        Intent g = new Intent(Intent.ACTION_GET_CONTENT);
                        g.addCategory(Intent.CATEGORY_OPENABLE);
                        g.setType("*/*");
                        startActivityForResult(g, REQ_FONT);
                    } catch (Exception e2) {
                        eval("window.__onFontError && window.__onFontError('没有可用的文件选择器');");
                    }
                }
            });
        }

        @JavascriptInterface
        public void removeFont() {
            try {
                File f = fontFile();
                if (f.exists()) f.delete();
                File tmp = new File(new File(getFilesDir(), "fonts"), "custom.tmp");
                if (tmp.exists()) tmp.delete();
                prefs.edit().remove("font_name").apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String getFontInfo() {
            return fontInfoJson();
        }

        @JavascriptInterface
        public void getLocation(String cb) {
            ui.post(() -> requestLocation(cb));
        }

        @JavascriptInterface
        public void sovits(String payload) {
            doSovits(payload);
        }
    }
}
