package ru.nexavpn.app;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.wireguard.android.backend.GoBackend;
import com.wireguard.android.backend.Statistics;
import com.wireguard.android.backend.Tunnel;
import com.wireguard.config.Config;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NexaVpn")
public class NexaVpnPlugin extends Plugin {

    public static String pendingKey;

    private static GoBackend backend;
    private static final Tunnel TUNNEL = new Tunnel() {
        @Override
        public String getName() {
            return "nexavpn";
        }

        @Override
        public void onStateChange(Tunnel.State newState) {
        }
    };

    private synchronized GoBackend backend() {
        if (backend == null) {
            backend = new GoBackend(getContext().getApplicationContext());
        }
        return backend;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String conf = call.getString("config");
        if (conf == null || conf.trim().isEmpty()) {
            call.reject("Пустая конфигурация");
            return;
        }
        Intent intent = GoBackend.VpnService.prepare(getContext());
        if (intent != null) {
            startActivityForResult(call, intent, "onVpnPermission");
            return;
        }
        up(call, conf);
    }

    @ActivityCallback
    private void onVpnPermission(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() == Activity.RESULT_OK) {
            up(call, call.getString("config"));
        } else {
            call.reject("Разрешение VPN не выдано");
        }
    }

    private void up(final PluginCall call, final String conf) {
        new Thread(() -> {
            try {
                Config cfg = Config.parse(new ByteArrayInputStream(conf.getBytes(StandardCharsets.UTF_8)));
                backend().setState(TUNNEL, Tunnel.State.UP, cfg);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Ошибка конфигурации" : e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(final PluginCall call) {
        new Thread(() -> {
            try {
                backend().setState(TUNNEL, Tunnel.State.DOWN, null);
            } catch (Exception ignored) {
            }
            call.resolve();
        }).start();
    }

    @PluginMethod
    public void takeKey(PluginCall call) {
        JSObject o = new JSObject();
        o.put("key", pendingKey);
        pendingKey = null;
        call.resolve(o);
    }

    @PluginMethod
    public void getStats(PluginCall call) {
        try {
            Statistics s = backend().getStatistics(TUNNEL);
            JSObject o = new JSObject();
            o.put("rx", s.totalRx());
            o.put("tx", s.totalTx());
            o.put("state", backend().getState(TUNNEL).name());
            call.resolve(o);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "stats" : e.getMessage());
        }
    }
}
