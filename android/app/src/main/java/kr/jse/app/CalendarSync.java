package kr.jse.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * 앱의 일정을 폰에 만든 "가계부 일정" 캘린더와 맞춥니다.
 * 각 일정은 SYNC_DATA1(일정 키)과 SYNC_DATA2(내용 지문)로 추적해서 바뀐 것만 추가·수정·삭제합니다.
 */
final class CalendarSync {
    private static final String ACCOUNT = "가계부";
    private static final String CALENDAR_NAME = "가계부 일정";
    private static final int COLOR = 0xFF9B5F6A;

    private CalendarSync() {
    }

    private static Uri asSyncAdapter(Uri uri) {
        return uri.buildUpon()
                .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                .appendQueryParameter(Calendars.ACCOUNT_NAME, ACCOUNT)
                .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                .build();
    }

    private static long calendarId(ContentResolver cr) {
        try (Cursor c = cr.query(Calendars.CONTENT_URI, new String[]{Calendars._ID},
                Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=?",
                new String[]{ACCOUNT, CalendarContract.ACCOUNT_TYPE_LOCAL}, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        ContentValues v = new ContentValues();
        v.put(Calendars.ACCOUNT_NAME, ACCOUNT);
        v.put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        v.put(Calendars.NAME, CALENDAR_NAME);
        v.put(Calendars.CALENDAR_DISPLAY_NAME, CALENDAR_NAME);
        v.put(Calendars.CALENDAR_COLOR, COLOR);
        v.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER);
        v.put(Calendars.OWNER_ACCOUNT, ACCOUNT);
        v.put(Calendars.VISIBLE, 1);
        v.put(Calendars.SYNC_EVENTS, 1);
        v.put(Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        Uri uri = cr.insert(asSyncAdapter(Calendars.CONTENT_URI), v);
        return uri == null ? -1 : Long.parseLong(uri.getLastPathSegment());
    }

    /** 동시에 두 번 돌면 같은 일정이 중복으로 들어가므로 한 번에 하나씩만 실행합니다. @return 바뀐 일정 수, 실패하면 -1 */
    static synchronized int sync(Context ctx, String json) {
        try {
            ContentResolver cr = ctx.getContentResolver();
            long calId = calendarId(cr);
            if (calId < 0) return -1;

            Map<String, long[]> existingIds = new HashMap<>();
            Map<String, String> existingHash = new HashMap<>();
            try (Cursor c = cr.query(Events.CONTENT_URI, new String[]{Events._ID, Events.SYNC_DATA1, Events.SYNC_DATA2},
                    Events.CALENDAR_ID + "=? AND " + Events.DELETED + "=0", new String[]{String.valueOf(calId)}, null)) {
                while (c != null && c.moveToNext()) {
                    String key = c.getString(1);
                    if (key == null) continue;
                    existingIds.put(key, new long[]{c.getLong(0)});
                    existingHash.put(key, c.getString(2));
                }
            }

            JSONArray items = new JSONArray(json);
            Set<String> seen = new HashSet<>();
            int changed = 0;
            String localZone = TimeZone.getDefault().getID();
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                String key = o.getString("key");
                seen.add(key);
                boolean allDay = o.getBoolean("allDay");
                ContentValues v = new ContentValues();
                v.put(Events.CALENDAR_ID, calId);
                v.put(Events.TITLE, o.optString("title", "일정"));
                v.put(Events.DTSTART, o.getLong("begin"));
                v.put(Events.DTEND, o.getLong("end"));
                v.put(Events.ALL_DAY, allDay ? 1 : 0);
                v.put(Events.EVENT_TIMEZONE, allDay ? "UTC" : localZone);
                v.put(Events.EVENT_LOCATION, o.optString("location", ""));
                v.put(Events.DESCRIPTION, o.optString("description", ""));
                String hash = String.valueOf(v.toString().hashCode());
                v.put(Events.SYNC_DATA1, key);
                v.put(Events.SYNC_DATA2, hash);

                long[] id = existingIds.get(key);
                if (id == null) {
                    cr.insert(asSyncAdapter(Events.CONTENT_URI), v);
                    changed++;
                } else if (!hash.equals(existingHash.get(key))) {
                    cr.update(asSyncAdapter(Uri.withAppendedPath(Events.CONTENT_URI, String.valueOf(id[0]))), v, null, null);
                    changed++;
                }
            }
            for (Map.Entry<String, long[]> e : existingIds.entrySet()) {
                if (seen.contains(e.getKey())) continue;
                cr.delete(asSyncAdapter(Uri.withAppendedPath(Events.CONTENT_URI, String.valueOf(e.getValue()[0]))), null, null);
                changed++;
            }
            return changed;
        } catch (Exception e) {
            return -1;
        }
    }
}
