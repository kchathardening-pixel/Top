package ru.youchat.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Приём push: новый токен передаём странице; уведомления в фоне показывает система. */
public class YCMessaging extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        MainActivity.saveToken(this, token);
        MainActivity.notifyToken();
    }

    @Override
    public void onMessageReceived(RemoteMessage m) {
        // Приложение открыто — сообщения и так приходят мгновенно, уведомление не нужно.
        if (MainActivity.foreground) return;
        RemoteMessage.Notification n = m.getNotification();
        if (n == null) return;
        String cid = m.getData() != null ? m.getData().get("cid") : null;
        Intent i = new Intent(this, MainActivity.class);
        i.setAction("YC_OPEN");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (cid != null) i.putExtra("cid", cid);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, cid != null ? cid.hashCode() : 0, i, flags);
        android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(this, "messages")
                : new android.app.Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(n.getTitle())
                .setContentText(n.getBody())
                .setAutoCancel(true)
                .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(cid != null ? cid.hashCode() : 1, b.build());
    }
}
