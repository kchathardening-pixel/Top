import asyncio, base64, io, logging, os, re, time, uuid

import qrcode
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandObject, CommandStart, Command
from aiogram.types import (BufferedInputFile, CallbackQuery, InlineKeyboardButton,
                           InlineKeyboardMarkup, Message)
from yookassa import Configuration, Payment


def load_env(path=".env"):
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()
import api, db, wg  # noqa: E402  (после загрузки .env)

BOT_TOKEN = os.environ["BOT_TOKEN"]
SHOP_ID = os.environ["YOOKASSA_SHOP_ID"]
SECRET = os.environ["YOOKASSA_SECRET_KEY"]
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
SUPPORT = os.getenv("SUPPORT_USERNAME", "")
API_PORT = int(os.getenv("API_PORT", "8080"))
Configuration.account_id = SHOP_ID
Configuration.secret_key = SECRET

# Тарифы. Цены можно менять здесь.
PLANS = {
    "m1": {"title": "1 месяц", "days": 30, "price": 149},
    "m3": {"title": "3 месяца", "days": 90, "price": 399},
    "m12": {"title": "12 месяцев", "days": 365, "price": 1290},
}

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
BOT_USERNAME = ""


def menu():
    rows = [
        [InlineKeyboardButton(text="Купить доступ", callback_data="buy")],
        [InlineKeyboardButton(text="Мой доступ", callback_data="my"),
         InlineKeyboardButton(text="Инструкция", callback_data="help")],
        [InlineKeyboardButton(text="Пробный период 24 часа", callback_data="trial")],
    ]
    if SUPPORT:
        rows.append([InlineKeyboardButton(text="Поддержка", url=f"https://t.me/{SUPPORT.lstrip('@')}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def fmt_date(ts):
    return time.strftime("%d.%m.%Y %H:%M", time.localtime(ts))


async def offer(uid, chat_id, key):
    p = PLANS[key]
    try:
        pid, url = await asyncio.to_thread(_create_payment, uid, key)
    except Exception:
        logging.exception("create payment")
        return await bot.send_message(chat_id, "Не удалось создать платёж. Попробуйте позже или напишите в поддержку.", reply_markup=menu())
    db.add_payment(pid, uid, key)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"Оплатить {p['price']} ₽", url=url)],
        [InlineKeyboardButton(text="Я оплатил, проверить", callback_data=f"chk:{pid}")],
    ])
    await bot.send_message(chat_id, f"Тариф: {p['title']}, {p['price']} ₽.\nПосле оплаты ключ придёт автоматически.", reply_markup=kb)


@dp.message(CommandStart())
async def start(m: Message, command: CommandObject):
    db.touch_user(m.from_user.id)
    await m.answer("NexaVPN. Свобода в интернете.\nБыстрый и безопасный VPN. Выберите действие.", reply_markup=menu())
    if command.args in PLANS:      # ссылка с сайта: t.me/бот?start=m1
        await offer(m.from_user.id, m.chat.id, command.args)


@dp.callback_query(F.data == "menu")
async def to_menu(c: CallbackQuery):
    await c.message.edit_text("NexaVPN. Выберите действие.", reply_markup=menu())
    await c.answer()


@dp.callback_query(F.data == "help")
async def help_(c: CallbackQuery):
    await c.message.answer(
        "Как подключиться:\n"
        "1. Установите приложение WireGuard (App Store, Google Play, Windows, macOS).\n"
        "2. Откройте «Мой доступ» в этом боте и получите QR-код или файл .conf.\n"
        "3. В WireGuard нажмите «+» и отсканируйте QR или импортируйте файл.\n"
        "4. Включите переключатель. Готово.")
    await c.answer()


@dp.callback_query(F.data == "buy")
async def buy(c: CallbackQuery):
    kb = [[InlineKeyboardButton(text=f"{p['title']} — {p['price']} ₽", callback_data=f"plan:{k}")]
          for k, p in PLANS.items()]
    kb.append([InlineKeyboardButton(text="Назад", callback_data="menu")])
    await c.message.edit_text("Выберите тариф:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await c.answer()


def _create_payment(uid, key):
    p = PLANS[key]
    pay = Payment.create({
        "amount": {"value": f"{p['price']}.00", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": f"https://t.me/{BOT_USERNAME}"},
        "capture": True,
        "description": f"NexaVPN, {p['title']}",
        "metadata": {"user_id": str(uid), "plan": key},
    }, str(uuid.uuid4()))
    return pay.id, pay.confirmation.confirmation_url


def _status(pid):
    return Payment.find_one(pid).status


@dp.callback_query(F.data.startswith("plan:"))
async def plan(c: CallbackQuery):
    key = c.data.split(":")[1]
    if key not in PLANS:
        return await c.answer("Тариф не найден", show_alert=True)
    try:
        pid, url = await asyncio.to_thread(_create_payment, c.from_user.id, key)
    except Exception:
        logging.exception("create payment")
        return await c.answer("Не удалось создать платёж. Попробуйте позже.", show_alert=True)
    db.add_payment(pid, c.from_user.id, key)
    p = PLANS[key]
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"Оплатить {p['price']} ₽", url=url)],
        [InlineKeyboardButton(text="Я оплатил, проверить", callback_data=f"chk:{pid}")],
    ])
    await c.message.edit_text(f"Тариф: {p['title']}, {p['price']} ₽.\nПосле оплаты доступ придёт автоматически.", reply_markup=kb)
    await c.answer()


async def activate(uid, days):
    """Продлевает или создаёт доступ. Возвращает запись подписки."""
    now = int(time.time())
    sub = db.get_sub(uid)
    if sub:
        base = max(now, sub["expires"])
        expires = base + days * 86400
        if not sub["active"]:
            await asyncio.to_thread(wg.add_peer, sub["pub"], sub["ip"])
        db.save_sub(uid, expires, sub["ip"], sub["priv"], sub["pub"], 1)
    else:
        priv, pub = await asyncio.to_thread(wg.gen_keys)
        ip = wg.free_ip(db.used_ips())
        await asyncio.to_thread(wg.add_peer, pub, ip)
        db.save_sub(uid, now + days * 86400, ip, priv, pub, 1)
    return db.get_sub(uid)


def make_key(conf):
    return "nexavpn://" + base64.urlsafe_b64encode(conf.encode()).decode().rstrip("=") + "#NexaVPN"


async def issue_key(days):
    """Выдача ключа из админки без привязки к Telegram."""
    uid = -int(time.time() * 1000)
    sub = await activate(uid, days)
    return make_key(await asyncio.to_thread(wg.client_conf, sub["priv"], sub["ip"]))


async def send_access(chat_id, uid):
    sub = db.get_sub(uid)
    if not sub or not sub["active"]:
        return await bot.send_message(chat_id, "Доступ не активен. Нажмите «Купить доступ».", reply_markup=menu())
    conf = await asyncio.to_thread(wg.client_conf, sub["priv"], sub["ip"])
    img = qrcode.make(conf)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    await bot.send_photo(chat_id, BufferedInputFile(buf.getvalue(), "nexavpn.png"),
                         caption=f"Доступ активен до {fmt_date(sub['expires'])}.\nОтсканируйте QR в приложении WireGuard.")
    await bot.send_document(chat_id, BufferedInputFile(conf.encode(), "NexaVPN.conf"), caption="Файл конфигурации")
    key = make_key(conf)
    await bot.send_message(chat_id, "Ключ для приложения NexaVPN. Нажмите на него, чтобы скопировать, и вставьте при первом запуске:\n\n<code>" + key + "</code>", parse_mode="HTML")


async def settle(pid):
    """Проверяет платёж и выдаёт доступ. True, если оплата прошла."""
    row = db.get_payment(pid)
    if not row:
        return False
    st = await asyncio.to_thread(_status, pid)
    if st == "succeeded":
        if db.set_payment_status(pid, "succeeded"):   # сработает один раз
            await activate(row["user_id"], PLANS[row["plan"]]["days"])
            await send_access(row["user_id"], row["user_id"])
        return True
    if st == "canceled":
        db.set_payment_status(pid, "canceled")
    return False


@dp.callback_query(F.data.startswith("chk:"))
async def check(c: CallbackQuery):
    pid = c.data.split(":", 1)[1]
    row = db.get_payment(pid)
    if not row or row["user_id"] != c.from_user.id:
        return await c.answer("Платёж не найден", show_alert=True)
    ok = await settle(pid)
    await c.answer("Оплата получена" if ok else "Оплата пока не поступила. Подождите минуту и нажмите снова.", show_alert=not ok)


@dp.callback_query(F.data == "my")
async def my(c: CallbackQuery):
    await send_access(c.message.chat.id, c.from_user.id)
    await c.answer()


@dp.callback_query(F.data == "trial")
async def trial(c: CallbackQuery):
    uid = c.from_user.id
    if db.trial_used(uid) or db.get_sub(uid):
        return await c.answer("Пробный период уже использован.", show_alert=True)
    db.touch_user(uid)
    db.mark_trial(uid)
    await activate(uid, 1)
    await send_access(c.message.chat.id, uid)
    await c.answer()


@dp.message(Command("stats"))
async def stats(m: Message):
    if m.from_user.id != ADMIN_ID:
        return
    s = db.stats()
    await m.answer(f"Пользователей: {s['users']}\nАктивных доступов: {s['active']}\nОплат: {s['paid']}")


@dp.message(F.reply_to_message, F.text)
async def admin_reply(m: Message):
    """Ответ админа на пересланное сообщение из чата приложения."""
    if m.from_user.id != ADMIN_ID:
        return
    dev = db.get_fwd(m.reply_to_message.message_id)
    if not dev:
        return
    db.add_msg(dev, "admin", m.text[:2000])
    await m.reply("Отправлено в приложение")


async def poller():
    """Фоновая проверка платежей и отключение истёкших доступов."""
    tick = 0
    while True:
        try:
            for p in db.pending_payments():
                await settle(p["id"])
            if tick % 30 == 0:
                for s in db.expired_active():
                    await asyncio.to_thread(wg.remove_peer, s["pub"])
                    db.set_inactive(s["user_id"])
                    try:
                        await bot.send_message(s["user_id"], "Срок доступа закончился. Продлить можно в меню.", reply_markup=menu())
                    except Exception:
                        pass
        except Exception:
            logging.exception("poller")
        tick += 1
        await asyncio.sleep(10)


async def main():
    global BOT_USERNAME
    logging.basicConfig(level=logging.INFO)
    BOT_USERNAME = (await bot.get_me()).username
    await api.start(bot, ADMIN_ID, API_PORT, PLANS, issue_key)
    asyncio.create_task(poller())
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
