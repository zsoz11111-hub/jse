package kr.jse.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.os.Parcelable;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * 주차 NFC 스티커를 태그하면 화면 없이 주차 위치만 저장하고, 위쪽에 잠깐 알림을 띄웁니다.
 * 비밀 값(k)이 없는 예전 스티커는 예전처럼 앱을 열어 저장합니다.
 */
public class ParkingTagActivity extends Activity {
    static final String CHANNEL = "parking";
    static final String RPC = "https://" + MainActivity.SUPABASE_HOST + "/rest/v1/rpc/nfc_parking";
    static final String API_KEY = "sb_publishable_QxUpj14szej9Pt6eOm-rNA_gDMCr36p";
    static final Map<String, String> FLOORS = new HashMap<>();

    static {
        FLOORS.put("B3", "지하 3층");
        FLOORS.put("B4", "지하 4층");
        FLOORS.put("B5", "지하 5층");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri u = getIntent() == null ? null : getIntent().getData();
        String floor = u == null ? null : u.getQueryParameter("parking");
        String car = u == null ? null : u.getQueryParameter("car");
        String key = u == null ? null : u.getQueryParameter("k");
        if (u == null) {
            // 텍스트 스티커 (예: "주차 니로 B3 비밀값"): 아이폰에서는 사파리 알림이 뜨지 않습니다.
            String[] t = parseText(readText());
            if (t == null) {
                finish();
                return;
            }
            car = t[0];
            floor = t[1];
            key = t[2];
        } else if (floor == null) {
            finish();
            return;
        }
        if (u != null && (key == null || car == null || !FLOORS.containsKey(floor))) {
            // 예전 스티커: 앱을 열어서 저장
            startActivity(new Intent(Intent.ACTION_VIEW, u, this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
            return;
        }
        final String fCar = car, fFloor = floor, fKey = key;
        new Thread(() -> {
            String result = save(fCar, fFloor, fKey);
            if (result == null) result = save(fCar, fFloor, fKey); // 한 번 더 시도
            String where = fCar + "가 " + FLOORS.get(fFloor) + "에 주차되었어요.";
            String msg;
            if ("ok".equals(result)) msg = where;
            else if ("dup".equals(result)) msg = where + " (방금 저장됨)";
            else if ("bad".equals(result)) msg = "주차 스티커 주소가 올바르지 않아요.";
            else msg = "주차 위치를 저장하지 못했어요. 인터넷을 확인하고 다시 태그해 주세요.";
            runOnUiThread(() -> {
                show(msg);
                finish();
            });
        }).start();
    }

    /** NFC 텍스트 레코드의 글자를 읽습니다. */
    private String readText() {
        try {
            Parcelable[] raw = getIntent().getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
            if (raw == null) return null;
            StringBuilder sb = new StringBuilder();
            for (Parcelable p : raw) {
                for (NdefRecord r : ((NdefMessage) p).getRecords()) {
                    if (r.getTnf() != NdefRecord.TNF_WELL_KNOWN || !Arrays.equals(r.getType(), NdefRecord.RTD_TEXT)) continue;
                    byte[] pl = r.getPayload();
                    if (pl.length == 0) continue;
                    int langLen = pl[0] & 0x3F;
                    java.nio.charset.Charset cs = (pl[0] & 0x80) != 0 ? StandardCharsets.UTF_16 : StandardCharsets.UTF_8;
                    sb.append(new String(pl, 1 + langLen, pl.length - 1 - langLen, cs)).append(' ');
                }
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** "주차 니로 B3 비밀값"처럼 띄어쓰기로 구분된 글자에서 차, 층, 비밀 값을 찾습니다. 순서는 상관없습니다. */
    static String[] parseText(String text) {
        if (text == null) return null;
        String car = null, floor = null, key = null;
        for (String t : text.trim().split("[\\s,|/]+")) {
            if (t.equals("니로") || t.equals("제네시스")) car = t;
            else if (t.matches("(?i)b?[345]")) floor = "B" + t.substring(t.length() - 1);
            else if (t.matches("[a-z0-9]{10,}")) key = t;
        }
        return car == null || floor == null || key == null ? null : new String[]{car, floor, key};
    }

    private String save(String car, String floor, String key) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(RPC).openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setDoOutput(true);
            c.setRequestProperty("apikey", API_KEY);
            c.setRequestProperty("Content-Type", "application/json");
            JSONObject body = new JSONObject().put("p_car", car).put("p_floor", floor).put("p_key", key);
            try (OutputStream out = c.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[256];
                int n = in.read(buf);
                return n <= 0 ? null : new String(buf, 0, n, StandardCharsets.UTF_8).replace("\"", "").trim();
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** 카톡처럼 위에 잠깐 뜨고 5초 뒤 사라지는 알림. 알림 권한이 없으면 아래쪽 짧은 메시지로 보여줍니다. */
    private void show(String msg) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        boolean allowed = (android.os.Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                && nm != null && nm.areNotificationsEnabled();
        if (!allowed) {
            Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_LONG).show();
            return;
        }
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "주차 기록", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("주차 스티커를 태그했을 때 잠깐 보여주는 알림");
            nm.createNotificationChannel(ch);
        }
        Notification n = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("주차 기록")
                .setContentText(msg)
                .setAutoCancel(true)
                .setTimeoutAfter(5000)
                .build();
        nm.notify(7001, n);
    }
}
