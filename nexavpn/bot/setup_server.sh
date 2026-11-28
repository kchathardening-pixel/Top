#!/usr/bin/env bash
# Запуск на чистом Ubuntu 22.04/24.04 от root:  bash setup_server.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }

APP=/opt/nexavpn-bot
SRC="$(pwd)"
IFACE_OUT=$(ip -4 route show default | awk '{print $5; exit}')
PUBIP=$(curl -4 -s https://ifconfig.me || hostname -I | awk '{print $1}')

apt-get update -y
apt-get install -y wireguard python3-venv python3-pip curl ufw

# --- WireGuard ---
umask 077
mkdir -p /etc/wireguard
if [ ! -f /etc/wireguard/wg0.conf ]; then
  wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub
  cat > /etc/wireguard/wg0.conf <<WG
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = $(cat /etc/wireguard/server.key)
SaveConfig = true
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o $IFACE_OUT -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -s 10.8.0.0/24 -o $IFACE_OUT -j MASQUERADE
WG
fi
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wg.conf
sysctl --system >/dev/null
systemctl enable --now wg-quick@wg0

ufw allow OpenSSH >/dev/null
ufw allow 51820/udp >/dev/null
ufw allow 8080/tcp >/dev/null
ufw --force enable >/dev/null

# --- Бот ---
mkdir -p "$APP"
cp -r bot.py api.py db.py wg.py requirements.txt .env.example "$APP"/
cd "$APP"
python3 -m venv venv
./venv/bin/pip install -q -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^WG_ENDPOINT=.*|WG_ENDPOINT=$PUBIP|" .env
  chmod 600 .env
fi

# --- Сайт и HTTPS через Caddy (адрес вида 1-2-3-4.sslip.io, домен покупать не нужно) ---
HOST="$(echo "$PUBIP" | tr . -).sslip.io"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
mkdir -p /opt/nexavpn-site
if [ -d "$SRC/site" ]; then
  cp -r "$SRC"/site/. /opt/nexavpn-site/
  sed -i "s|api: *\"[^\"]*\"|api: \"https://$HOST\"|" /opt/nexavpn-site/config.js
fi
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
  handle /api/* {
    reverse_proxy 127.0.0.1:8080
  }
  handle {
    root * /opt/nexavpn-site
    file_server
  }
}
CADDY
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
systemctl enable caddy >/dev/null && systemctl restart caddy

cat > /etc/systemd/system/nexavpn-bot.service <<UNIT
[Unit]
Description=NexaVPN bot
After=network-online.target wg-quick@wg0.service

[Service]
WorkingDirectory=$APP
ExecStart=$APP/venv/bin/python bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable nexavpn-bot >/dev/null

echo
echo "Готово. Публичный ключ WireGuard сервера: $(cat /etc/wireguard/server.pub)"
echo "IP сервера: $PUBIP"
echo "Сайт и API: https://$HOST"
echo "Дальше: nano $APP/.env  (BOT_TOKEN, YOOKASSA_SECRET_KEY, ADMIN_ID, ADMIN_LOGIN, ADMIN_PASSWORD)"
echo "Затем:  systemctl start nexavpn-bot && journalctl -u nexavpn-bot -f"
