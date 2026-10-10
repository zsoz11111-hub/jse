package kr.jse.app;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.HashSet;
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
            String label = appLabel(pkg);

            boolean finance = FINANCE_APPS.contains(pkg) || FINANCE_PACKAGE.matcher(pkg).find() || FINANCE_WORDS.matcher(label).find();
            boolean message = MESSAGE_APPS.contains(pkg) && FINANCE_WORDS.matcher(title + " " + text).find();
            if (!finance && !message) return;
            PaymentStore.handle(this, message && !title.isEmpty() ? title : label, title, text, sbn.getPostTime());
        } catch (Exception ignored) {
        }
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
