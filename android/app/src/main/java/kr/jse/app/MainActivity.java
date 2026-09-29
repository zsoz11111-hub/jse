package kr.jse.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** 웹 앱(GitHub Pages)을 그대로 띄우고, 캘린더 추가와 파일 저장만 폰 기능으로 연결합니다. */
public class MainActivity extends Activity {
    static final String HOME = "https://zsoz11111-hub.github.io/jse/";
    static final String QUICK_EXPENSE = HOME + "?quick=expense";
    static final String SUPABASE_HOST = "qrcfwedbmlsrhgmgwqya.supabase.co";

    static final int CALENDAR_PERMISSION_REQUEST = 1;

    private WebView web;
    private String pendingCalendarJson;
    private boolean calendarPermissionAsked;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " JseApp/1");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u.toString().startsWith(HOME) || SUPABASE_HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(isQuickExpense(getIntent()) ? QUICK_EXPENSE : HOME);
    }

    private boolean isQuickExpense(Intent i) {
        if (i == null) return false;
        if (i.getComponent() != null && i.getComponent().getClassName().endsWith(".ExpenseShortcut")) return true;
        return i.getData() != null && QUICK_EXPENSE.equals(i.getData().toString());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isQuickExpense(intent)) {
            web.evaluateJavascript("typeof openQuickMoney==='function'&&!document.querySelector('#app').hidden&&openQuickMoney()", null);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // 열린 창을 닫거나 홈 화면으로 이동하고, 더 갈 곳이 없으면 앱을 닫습니다.
        web.evaluateJavascript(
                "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return 1}"
                        + "var a=document.querySelector('#app'),h=document.querySelector('#homeView');"
                        + "if(a&&!a.hidden&&h&&!h.classList.contains('active')&&typeof switchView==='function'){switchView('home');return 1}return 0})()",
                v -> {
                    if (!"1".equals(v)) finish();
                });
    }

    private boolean hasCalendarPermission() {
        return checkSelfPermission(Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    private synchronized void runCalendarSync() {
        String json = pendingCalendarJson;
        pendingCalendarJson = null;
        if (json == null) return;
        new Thread(() -> CalendarSync.sync(this, json)).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CALENDAR_PERMISSION_REQUEST) return;
        if (hasCalendarPermission()) {
            runCalendarSync();
            Toast.makeText(this, "앱 일정이 폰 캘린더 '가계부 일정'에 자동으로 등록됩니다.", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, "캘린더 권한이 없어 일정 자동 등록을 할 수 없습니다.", Toast.LENGTH_LONG).show();
        }
    }

    class Bridge {
        /** 앱의 전체 일정 목록(JSON)을 받아 폰 캘린더와 맞춥니다. */
        @JavascriptInterface
        public void syncCalendar(String json) {
            synchronized (MainActivity.this) {
                pendingCalendarJson = json;
            }
            runOnUiThread(() -> {
                if (hasCalendarPermission()) runCalendarSync();
                else if (!calendarPermissionAsked) {
                    calendarPermissionAsked = true;
                    requestPermissions(new String[]{Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR}, CALENDAR_PERMISSION_REQUEST);
                }
            });
        }

        @JavascriptInterface
        public void addCalendarEvent(String title, long begin, long end, boolean allDay, String location, String description) {
            Intent i = new Intent(Intent.ACTION_INSERT)
                    .setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
                    .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
                    .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, allDay)
                    .putExtra(CalendarContract.Events.TITLE, title)
                    .putExtra(CalendarContract.Events.EVENT_LOCATION, location)
                    .putExtra(CalendarContract.Events.DESCRIPTION, description);
            if (allDay) i.putExtra(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
            runOnUiThread(() -> {
                try {
                    startActivity(i);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "캘린더 앱을 열 수 없습니다.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public boolean saveFile(String name, String mime, String text) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            try {
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return false;
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) return false;
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
