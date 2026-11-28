import sqlite3, time, threading, os

_path = os.getenv("DB_PATH", "bot.db")
_lock = threading.Lock()
_c = sqlite3.connect(_path, check_same_thread=False)
_c.row_factory = sqlite3.Row
_c.executescript("""
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, trial_used INTEGER DEFAULT 0, created INTEGER);
CREATE TABLE IF NOT EXISTS subs(user_id INTEGER PRIMARY KEY, expires INTEGER, ip TEXT, priv TEXT, pub TEXT, active INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT, frm TEXT, text TEXT, ts INTEGER, img TEXT);
CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, text TEXT, ts INTEGER, pinned INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS fwd(msg_id INTEGER PRIMARY KEY, device TEXT);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, user_id INTEGER, plan TEXT, status TEXT, created INTEGER);
""")
try:
    _c.execute("ALTER TABLE msgs ADD COLUMN img TEXT")
except sqlite3.OperationalError:
    pass
_c.commit()


def q(sql, args=(), one=False, write=False):
    with _lock:
        cur = _c.execute(sql, args)
        if write:
            _c.commit()
        return (cur.fetchone() if one else cur.fetchall()) if not write else cur.rowcount


def touch_user(uid):
    q("INSERT OR IGNORE INTO users(id, created) VALUES(?, ?)", (uid, int(time.time())), write=True)


def get_sub(uid):
    return q("SELECT * FROM subs WHERE user_id=?", (uid,), one=True)


def used_ips():
    return {r["ip"] for r in q("SELECT ip FROM subs WHERE ip IS NOT NULL")}


def save_sub(uid, expires, ip, priv, pub, active=1):
    q("INSERT INTO subs(user_id, expires, ip, priv, pub, active) VALUES(?,?,?,?,?,?) "
      "ON CONFLICT(user_id) DO UPDATE SET expires=excluded.expires, ip=excluded.ip, priv=excluded.priv, pub=excluded.pub, active=excluded.active",
      (uid, expires, ip, priv, pub, active), write=True)


def expired_active():
    return q("SELECT * FROM subs WHERE active=1 AND expires<?", (int(time.time()),))


def set_inactive(uid):
    q("UPDATE subs SET active=0 WHERE user_id=?", (uid,), write=True)


def add_payment(pid, uid, plan):
    q("INSERT OR IGNORE INTO payments(id,user_id,plan,status,created) VALUES(?,?,?,?,?)",
      (pid, uid, plan, "pending", int(time.time())), write=True)


def pending_payments():
    return q("SELECT * FROM payments WHERE status='pending' AND created>?", (int(time.time()) - 86400,))


def get_payment(pid):
    return q("SELECT * FROM payments WHERE id=?", (pid,), one=True)


def set_payment_status(pid, status):
    """True only if the status actually changed (makes activation idempotent)."""
    return q("UPDATE payments SET status=? WHERE id=? AND status='pending'", (status, pid), write=True) > 0


def trial_used(uid):
    r = q("SELECT trial_used FROM users WHERE id=?", (uid,), one=True)
    return bool(r and r["trial_used"])


def mark_trial(uid):
    q("UPDATE users SET trial_used=1 WHERE id=?", (uid,), write=True)


def stats():
    now = int(time.time())
    return {
        "users": q("SELECT COUNT(*) c FROM users", one=True)["c"],
        "active": q("SELECT COUNT(*) c FROM subs WHERE active=1 AND expires>?", (now,), one=True)["c"],
        "paid": q("SELECT COUNT(*) c FROM payments WHERE status='succeeded'", one=True)["c"],
    }


# ---------- чат поддержки ----------
def add_msg(device, frm, text, img=None):
    with _lock:
        cur = _c.execute("INSERT INTO msgs(device, frm, text, ts, img) VALUES(?,?,?,?,?)", (device, frm, text, int(time.time()), img))
        _c.commit()
        return cur.lastrowid


def msgs_after(device, after):
    return q("SELECT id, text, ts, img FROM msgs WHERE device=? AND frm='admin' AND id>? ORDER BY id LIMIT 50", (device, after))


def recent_user_msgs(device, seconds=3600):
    return q("SELECT COUNT(*) c FROM msgs WHERE device=? AND frm='user' AND ts>?", (device, int(time.time()) - seconds), one=True)["c"]


def set_fwd(msg_id, device):
    q("INSERT OR REPLACE INTO fwd(msg_id, device) VALUES(?,?)", (msg_id, device), write=True)


def get_fwd(msg_id):
    r = q("SELECT device FROM fwd WHERE msg_id=?", (msg_id,), one=True)
    return r["device"] if r else None


# ---------- новости ----------
def news_list():
    return q("SELECT id, title, text, ts, pinned FROM news ORDER BY pinned DESC, ts DESC LIMIT 50")


def news_save(nid, title, text, pinned):
    if nid:
        q("UPDATE news SET title=?, text=?, pinned=? WHERE id=?", (title, text, int(pinned), nid), write=True)
        return nid
    with _lock:
        cur = _c.execute("INSERT INTO news(title, text, ts, pinned) VALUES(?,?,?,?)", (title, text, int(time.time()), int(pinned)))
        _c.commit()
        return cur.lastrowid


def news_del(nid):
    q("DELETE FROM news WHERE id=?", (nid,), write=True)


# ---------- админка ----------
def chats_list():
    return q("""
      SELECT m.device, m.text, m.frm, m.ts, m.img,
        (SELECT COUNT(*) FROM msgs u WHERE u.device=m.device AND u.frm='user'
           AND u.id > COALESCE((SELECT MAX(id) FROM msgs a WHERE a.device=m.device AND a.frm='admin'), 0)) AS waiting
      FROM msgs m WHERE m.id=(SELECT MAX(id) FROM msgs WHERE device=m.device)
      ORDER BY m.id DESC LIMIT 100""")


def chat_msgs(device, after=0):
    return q("SELECT id, frm, text, ts, img FROM msgs WHERE device=? AND id>? ORDER BY id LIMIT 300", (device, after))


def all_subs():
    return q("SELECT user_id, expires, active, ip FROM subs ORDER BY expires DESC LIMIT 200")


def recent_payments():
    return q("SELECT id, user_id, plan, status, created FROM payments ORDER BY created DESC LIMIT 50")


def paid_by_plan():
    return q("SELECT plan, COUNT(*) c FROM payments WHERE status='succeeded' GROUP BY plan")


def find_sub_by_pub(pub):
    return q("SELECT * FROM subs WHERE pub=?", (pub,), one=True)
