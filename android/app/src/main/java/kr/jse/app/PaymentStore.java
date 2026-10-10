package kr.jse.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 결제 알림에서 금액과 사용처를 뽑아 폰 안에만 "검토 대기" 목록으로 저장합니다.
 * 가계부에 넣을지는 사용자가 앱에서 검토해서 정합니다.
 */
final class PaymentStore {
    private static final String PREFS = "payments";
    private static final String KEY = "pending";
    private static final int MAX_ITEMS = 200;
    private static final long DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

    /** 지출로 볼 만한 단어 */
    private static final Pattern SPEND = Pattern.compile("결제|승인|출금|이체|송금|지출|사용|체크카드|일시불|할부|자동납부");
    /** 지출이 아닌 알림 (취소·입금·환불·적립·충전 등) */
    private static final Pattern NOT_SPEND = Pattern.compile("취소|입금|환불|충전|받았|받기|들어왔|\\(광고\\)|\\[광고\\]|대출|명세서|청구서|결제 예정|결제예정");
    private static final Pattern AMOUNT = Pattern.compile("([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\\s*원");
    private static final Pattern NOT_AMOUNT_BEFORE = Pattern.compile("(잔액|누적|한도|포인트|적립|잔고|남은)\\s*[:：]?\\s*$");
    /** 사용처가 아닌 부분: [Web발신], 괄호, 금액, 날짜, 시간, 마스킹된 이름·번호, 잔액·누적 표시 */
    private static final Pattern NOISE = Pattern.compile(
            "\\[[^\\]]*\\]|\\([^)]*\\)|[0-9]{1,3}(?:,[0-9]{3})+\\s*원|[0-9]+\\s*원|[0-9]{1,4}[/.-][0-9]{1,2}(?:[/.-][0-9]{1,2})?|[0-9]{1,2}:[0-9]{2}|"
                    + "\\S*\\*\\S*|(?:잔액|누적|한도)\\S*");
    /** 이 단어가 들어간 토큰은 사용처가 아닙니다. */
    private static final Pattern NOT_MERCHANT = Pattern.compile("승인|결제|완료|출금|이체|송금|사용|일시불|할부|체크|신용|카드|되었|했어|합니다|알림|안내|금액");
    private static final Pattern PARTICLE = Pattern.compile("(에서|으로|에게|님|로|에)$");
    private static final Set<String> STOP = new HashSet<>();

    static {
        for (String s : new String[]{"현대카드", "국민", "KB", "국민은행", "KB국민", "스타뱅킹", "토스", "카카오페이", "카카오", "네이버페이", "네이버", "Npay",
                "Web발신", "알림", "안내", "내역", "금액", "가맹점", "거래", "계좌", "본인", "체크카드", "신용카드", "페이", "머니", "포인트", "님이", "고객님"}) {
            STOP.add(s.toLowerCase(Locale.ROOT));
        }
    }

    private PaymentStore() {
    }

    /** 결제 알림이면 검토 대기 목록에 추가합니다. */
    static synchronized void handle(Context ctx, String appLabel, String title, String text, long postTime) {
        String full = ((title == null ? "" : title) + " " + (text == null ? "" : text)).replaceAll("\\s+", " ").trim();
        if (full.isEmpty() || !SPEND.matcher(full).find() || NOT_SPEND.matcher(full).find()) return;
        long amount = findAmount(full);
        if (amount <= 0) return;

        try {
            JSONArray list = load(ctx);
            String id = Integer.toHexString((appLabel + "|" + full).hashCode()) + "-" + (postTime / 60000);
            for (int i = 0; i < list.length(); i++) {
                JSONObject o = list.getJSONObject(i);
                if (o.getString("id").equals(id)) return; // 같은 알림이 다시 갱신된 경우
                if (o.getLong("amount") == amount && Math.abs(o.getLong("time") - postTime) < DUPLICATE_WINDOW_MS) return; // 카드·은행 중복
            }
            JSONObject o = new JSONObject();
            o.put("id", id);
            o.put("app", appLabel);
            o.put("text", full.length() > 160 ? full.substring(0, 160) + "…" : full);
            o.put("amount", amount);
            o.put("merchant", guessMerchant(full, title, appLabel));
            o.put("time", postTime);
            list.put(o);
            while (list.length() > MAX_ITEMS) list.remove(0);
            save(ctx, list);
        } catch (Exception ignored) {
        }
    }

    static long findAmount(String full) {
        Matcher m = AMOUNT.matcher(full);
        while (m.find()) {
            String before = full.substring(Math.max(0, m.start() - 8), m.start());
            if (NOT_AMOUNT_BEFORE.matcher(before).find()) continue;
            try {
                long v = Long.parseLong(m.group(1).replace(",", ""));
                if (v > 0) return v;
            } catch (NumberFormatException ignored) {
            }
        }
        return 0;
    }

    static String guessMerchant(String full, String title, String appLabel) {
        String rest = NOISE.matcher(full).replaceAll(" ");
        for (String token : rest.split("[\\s|·,:;/]+")) {
            String t = token.trim();
            if (NOT_MERCHANT.matcher(t).find()) continue;
            t = PARTICLE.matcher(PARTICLE.matcher(t).replaceAll("")).replaceAll("");
            if (t.length() < 2 || t.matches("[0-9-]+") || STOP.contains(t.toLowerCase(Locale.ROOT))) continue;
            if (title != null && t.equals(title.trim())) continue;
            return t;
        }
        return appLabel;
    }

    static synchronized String pendingJson(Context ctx) {
        return load(ctx).toString();
    }

    static synchronized void remove(Context ctx, String idsJson) {
        try {
            JSONArray ids = new JSONArray(idsJson);
            Set<String> drop = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) drop.add(ids.getString(i));
            JSONArray list = load(ctx), keep = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject o = list.getJSONObject(i);
                if (!drop.contains(o.getString("id"))) keep.put(o);
            }
            save(ctx, keep);
        } catch (Exception ignored) {
        }
    }

    private static JSONArray load(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context ctx, JSONArray list) {
        prefs(ctx).edit().putString(KEY, list.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
