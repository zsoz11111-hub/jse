package kr.jse.app;

import android.app.Notification;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** 은행·카드·페이 앱과 문자·카톡 알림 중 결제 알림만 골라 PaymentStore에 넘깁니다. */
public class PaymentListener extends NotificationListenerService {
    /** 금융 앱: 알림 전체를 검사합니다. */
    private static final Set<String> FINANCE_APPS = new HashSet<>(Arrays.asList(
            "com.naverfin.payapp", "com.nhn.android.search",
            "com.hyundaicard.appcard", "com.hyundaicard.weather",
            "com.kbstar.kbbank", "com.kbstar.liivbank", "com.kbcard.cxh.appcard", "com.kbcard.kbkookmincard",
            "viva.republica.toss",
            "com.kakaopay.app",
            "com.kakaobank.channel", "com.kbankwith.smartbank",
            "com.hanaskcard.paycllct", "com.kebhana.hanapush",
            "com.shinhan.sbanking", "com.shcard.smartpay", "com.wooribank.smart.npib", "kr.co.samsungcard.mpocket",
            "com.nhnent.payapp", "com.samsung.android.spay"));
    /** 목록에 없는 금융 앱도 패키지 이름으로 알아봅니다 (예: com.xxx.bank, xxxcard, xxxpay) */
    private static final Pattern FINANCE_PACKAGE = Pattern.compile("bank|card|pay|toss", Pattern.CASE_INSENSITIVE);
    /** 문자·카톡: 카드사나 은행이 보낸 알림만 검사합니다. */
    private static final Set<String> MESSAGE_APPS = new HashSet<>(Arrays.asList(
            "com.samsung.android.messaging", "com.google.android.apps.messaging", "com.kakao.talk"));
    private static final Pattern FINANCE_WORDS = Pattern.compile("카드|은행|뱅크|페이|pay|Pay|토스|KB|국민|현대|Web발신", Pattern.CASE_INSENSITIVE);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (getPackageName().equals(pkg)) return;
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle e = n.extras;
            String title = str(e.getCharSequence(Notification.EXTRA_TITLE));
            CharSequence big = e.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String text = str(big != null ? big : e.getCharSequence(Notification.EXTRA_TEXT));
            String sub = str(e.getCharSequence(Notification.EXTRA_SUB_TEXT));
            // 여러 줄 알림(InboxStyle)은 본문이 줄 목록에만 들어 있는 경우가 있습니다.
            CharSequence[] lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null && lines.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (CharSequence l : lines) sb.append(l).append(' ');
                text = text + " " + sb;
            }
            String label = appLabel(pkg);
            // 문자·카톡(MessagingStyle)은 메시지가 여러 개 묶여 오므로 하나씩 따로 봅니다. 본문에는 "새 메시지 3개"처럼만 오기도 합니다.
            List<String> messages = new ArrayList<>();
            Parcelable[] msgs = e.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (msgs != null) for (Parcelable p : msgs) if (p instanceof Bundle) {
                String t = str(((Bundle) p).getCharSequence("text"));
                if (!t.isEmpty()) messages.add(t);
            }

            String all = title + " " + text + " " + sub + " " + String.join(" ", messages);
            boolean finance = FINANCE_APPS.contains(pkg) || FINANCE_PACKAGE.matcher(pkg).find() || FINANCE_WORDS.matcher(label).find();
            boolean message = MESSAGE_APPS.contains(pkg) && FINANCE_WORDS.matcher(all).find();
            if (!finance && !message) return;
            String source = message && !title.isEmpty() ? title : label;
            if (messages.isEmpty()) PaymentStore.handle(this, source, title, (text + " " + sub).trim(), sbn.getPostTime());
            else for (String m : messages) PaymentStore.handle(this, source, title, m, sbn.getPostTime());
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        // 삼성 절전 등으로 연결이 끊기면 다시 연결을 요청합니다.
        requestRebind(new ComponentName(this, PaymentListener.class));
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String str(CharSequence c) {
        return c == null ? "" : c.toString();
    }
}
