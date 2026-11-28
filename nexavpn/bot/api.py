"""HTTP API: чат поддержки, новости, вход по ключу, админка. Работает внутри процесса бота."""
import asyncio, base64, hmac, os, re, secrets, time, uuid

from aiohttp import web
from aiogram.types import FSInputFile

import db, wg

DEV_RE = re.compile(r"^[A-Za-z0-9]{8,64}$")
KEY_RE = re.compile(r"^[A-Za-z0-9+/]{43}=$")
IMG_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$")
FILE_RE = re.compile(r"^[a-f0-9]{32}\.(png|jpg|webp)$")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "").lstrip("@").lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

ctx = {}          # bot, admin_id, plans, issue
tokens = {}       # token -> expires
fails = {}        # ip -> (count, blocked_until)
hits = {}         # ip -> (window_start, count)


def ip_of(r):
    return (r.headers.get("X-Forwarded-For", "").split(",")[0].strip() or r.remote or "?")


def limited(r, limit=30, window=60):
    ip, now = ip_of(r), time.time()
    start, n = hits.get(ip, (now, 0))
    if now - start > window:
        start, n = now, 0
    hits[ip] = (start, n + 1)
    return n + 1 > limit


def need_admin(r):
    tok = r.headers.get("Authorization", "").replace("Bearer ", "").strip()
    exp = tokens.get(tok)
    if not exp or exp < time.time():
        raise web.HTTPUnauthorized(text="auth")


def ok(**kw):
    return web.json_response({"ok": True, **kw})


def bad(msg="bad", status=400):
    return web.json_response({"ok": False, "error": msg}, status=status)


@web.middleware
async def cors(request, handler):
    try:
        resp = web.Response() if request.method == "OPTIONS" else await handler(request)
    except web.HTTPException as e:
        resp = web.json_response({"ok": False, "error": e.text or e.reason}, status=e.status)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return resp


# ---------- публичные ----------
async def news(request):
    return ok(news=[dict(r) for r in db.news_list()])


async def support_send(request):
    if limited(request, 20, 60):
        return bad("limit", 429)
    try:
        data = await request.json()
    except Exception:
        return bad()
    dev, text = str(data.get("device", "")), str(data.get("text", "")).strip()[:1000]
    image = data.get("image")
    if not DEV_RE.match(dev) or (not text and not image):
        return bad()
    if db.recent_user_msgs(dev) >= 40:
        return bad("limit", 429)
    fname, path = None, None
    if image:
        m = IMG_RE.match(str(image))
        if not m:
            return bad("image")
        raw = base64.b64decode(m.group(2))
        if len(raw) > 3 * 1024 * 1024:
            return bad("image_size")
        fname = uuid.uuid4().hex + "." + ("jpg" if m.group(1) == "jpeg" else m.group(1))
        path = os.path.join(UPLOAD_DIR, fname)
        with open(path, "wb") as f:
            f.write(raw)
    db.add_msg(dev, "user", text, fname)
    bot, admin_id = ctx["bot"], ctx["admin_id"]
    if admin_id:
        head = f"Чат сайта/приложения, устройство {dev[:6]}"
        if path:
            sent = await bot.send_photo(admin_id, FSInputFile(path), caption=(head + ":\n\n" + text)[:1000])
        else:
            sent = await bot.send_message(admin_id, f"{head}:\n\n{text}\n\n(ответьте на это сообщение, и ответ придёт пользователю)")
        db.set_fwd(sent.message_id, dev)
    return ok()


async def support_poll(request):
    dev = request.query.get("device", "")
    try:
        after = int(request.query.get("after", "0"))
    except ValueError:
        after = 0
    if not DEV_RE.match(dev):
        return ok(messages=[])
    return ok(messages=[{"id": r["id"], "text": r["text"], "ts": r["ts"], "img": r["img"]} for r in db.msgs_after(dev, after)])


async def uploads(request):
    name = request.match_info["name"]
    if not FILE_RE.match(name):
        raise web.HTTPNotFound()
    p = os.path.join(UPLOAD_DIR, name)
    if not os.path.exists(p):
        raise web.HTTPNotFound()
    return web.FileResponse(p, headers={"Cache-Control": "public, max-age=86400"})


def conf_from_key(key):
    key = key.strip()
    if key.lower().startswith("nexavpn://"):
        body = key[10:].split("#")[0]
        body = body.replace("-", "+").replace("_", "/")
        body += "=" * (-len(body) % 4)
        return base64.b64decode(body).decode("utf-8", "ignore")
    return key


async def key_info(request):
    if limited(request, 20, 60):
        return bad("limit", 429)
    try:
        data = await request.json()
        conf = conf_from_key(str(data.get("key", "")))
        m = re.search(r"PrivateKey\s*=\s*(\S+)", conf)
        if not m or not KEY_RE.match(m.group(1)):
            return bad("key")
        pub = await asyncio.to_thread(wg.pubkey, m.group(1))
    except Exception:
        return bad("key")
    sub = db.find_sub_by_pub(pub)
    if not sub:
        return bad("not_found", 404)
    now = int(time.time())
    return ok(active=bool(sub["active"] and sub["expires"] > now), expires=sub["expires"], left=max(0, sub["expires"] - now))


# ---------- админка ----------
async def admin_login(request):
    ip, now = ip_of(request), time.time()
    cnt, until = fails.get(ip, (0, 0))
    if cnt >= 5 and now < until:
        return bad("blocked", 429)
    try:
        data = await request.json()
    except Exception:
        return bad()
    login = str(data.get("login", "")).strip().lstrip("@").lower()
    pw = str(data.get("password", ""))
    good = bool(ADMIN_LOGIN and ADMIN_PASSWORD) and \
        hmac.compare_digest(login.encode(), ADMIN_LOGIN.encode()) and \
        hmac.compare_digest(pw.encode(), ADMIN_PASSWORD.encode())
    if not good:
        fails[ip] = (cnt + 1, now + 600)
        return bad("wrong", 401)
    fails.pop(ip, None)
    tok = secrets.token_urlsafe(32)
    tokens[tok] = now + 12 * 3600
    return ok(token=tok)


async def admin_stats(request):
    need_admin(request)
    s, plans = db.stats(), ctx["plans"]
    revenue = sum(plans.get(r["plan"], {}).get("price", 0) * r["c"] for r in db.paid_by_plan())
    pays = [{"id": r["id"][:8], "user": r["user_id"], "plan": plans.get(r["plan"], {}).get("title", r["plan"]),
             "status": r["status"], "ts": r["created"]} for r in db.recent_payments()]
    return ok(stats={**s, "revenue": revenue}, payments=pays)


async def admin_news_save(request):
    need_admin(request)
    d = await request.json()
    title, text = str(d.get("title", "")).strip()[:120], str(d.get("text", "")).strip()[:2000]
    if not title or not text:
        return bad("empty")
    nid = db.news_save(int(d["id"]) if d.get("id") else None, title, text, bool(d.get("pinned")))
    return ok(id=nid)


async def admin_news_del(request):
    need_admin(request)
    db.news_del(int(request.match_info["id"]))
    return ok()


async def admin_chats(request):
    need_admin(request)
    return ok(chats=[{"device": r["device"], "text": r["text"] or "[фото]", "frm": r["frm"], "ts": r["ts"], "waiting": r["waiting"]} for r in db.chats_list()])


async def admin_chat(request):
    need_admin(request)
    dev = request.query.get("device", "")
    after = int(request.query.get("after", "0") or 0)
    if not DEV_RE.match(dev):
        return bad()
    return ok(messages=[dict(r) for r in db.chat_msgs(dev, after)])


async def admin_reply(request):
    need_admin(request)
    d = await request.json()
    dev, text = str(d.get("device", "")), str(d.get("text", "")).strip()[:2000]
    if not DEV_RE.match(dev) or not text:
        return bad()
    db.add_msg(dev, "admin", text)
    return ok()


async def admin_subs(request):
    need_admin(request)
    now = int(time.time())
    return ok(subs=[{"id": r["user_id"], "expires": r["expires"], "active": bool(r["active"] and r["expires"] > now), "ip": r["ip"]} for r in db.all_subs()])


async def admin_issue(request):
    need_admin(request)
    d = await request.json()
    days = max(1, min(int(d.get("days", 30)), 3650))
    key = await ctx["issue"](days)
    return ok(key=key)


async def noop(request):
    return web.Response()


async def start(bot, admin_id, port, plans, issue):
    ctx.update(bot=bot, admin_id=admin_id, plans=plans, issue=issue)
    app = web.Application(middlewares=[cors], client_max_size=6 * 1024 * 1024)
    r = app.router
    r.add_get("/api/news", news)
    r.add_post("/api/support/send", support_send)
    r.add_get("/api/support/poll", support_poll)
    r.add_get("/api/uploads/{name}", uploads)
    r.add_post("/api/key/info", key_info)
    r.add_post("/api/admin/login", admin_login)
    r.add_get("/api/admin/stats", admin_stats)
    r.add_post("/api/admin/news", admin_news_save)
    r.add_delete("/api/admin/news/{id}", admin_news_del)
    r.add_get("/api/admin/chats", admin_chats)
    r.add_get("/api/admin/chat", admin_chat)
    r.add_post("/api/admin/reply", admin_reply)
    r.add_get("/api/admin/subs", admin_subs)
    r.add_post("/api/admin/issue", admin_issue)
    r.add_route("OPTIONS", "/{tail:.*}", noop)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", port).start()
