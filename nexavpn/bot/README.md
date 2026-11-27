# NexaVPN bot

Бот продаёт доступ к WireGuard: тарифы, оплата через ЮKassa, автоматическая выдача QR и .conf, продление, отключение по сроку, пробный период.

1. Купите VPS с Ubuntu 22.04 или 24.04.
2. Загрузите эту папку на сервер и выполните `bash setup_server.sh` от root.
3. Заполните `/opt/nexavpn-bot/.env`: BOT_TOKEN, YOOKASSA_SECRET_KEY, ADMIN_ID.
4. `systemctl start nexavpn-bot`

Цены меняются в `bot.py` в словаре PLANS.
