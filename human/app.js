'use strict';
/* HUMAN CRMP — сайт сервера. Данные: Supabase (таблицы hc_*). */
const SUPA_URL = 'https://nkpjncbdorvhfetmpiwy.supabase.co';
const SUPA_KEY = 'sb_publishable_q-7V-ivgprZeErOybcRtqg_TPXGQGk-';
const MAIL_DOMAIN = 'players.human-crmp.ru';

const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, storageKey: 'human-crmp-auth' } });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const fdate = s => { const d = new Date(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const ago = s => {
  const m = Math.round((Date.now() - new Date(s)) / 6e4);
  if (m < 1) return 'только что'; if (m < 60) return m + ' мин назад';
  const h = Math.round(m / 60); if (h < 24) return h + ' ч назад';
  const d = Math.round(h / 24); if (d < 7) return d + ' дн назад';
  return fdate(s);
};
function rich(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function paras(t) { return String(t || '').split(/\n{2,}/).map(p => '<p>' + rich(p).replace(/\n/g, '<br>') + '</p>').join(''); }
let toastT;
function toast(t, bad) { const e = $('#toast'); e.textContent = t; e.className = bad ? 'on bad' : 'on'; clearTimeout(toastT); toastT = setTimeout(() => e.className = bad ? 'bad' : '', 3200); }
const ERR = {
  nick_taken: 'Этот ник уже занят', bad_nick: 'Ник: латиница, цифры и _, от 3 до 24 символов', no_money: 'Недостаточно средств на балансе',
  no_product: 'Товар недоступен', forbidden: 'Нет прав', admin_exists: 'Администратор уже назначен', not_authenticated: 'Войдите в аккаунт',
  already_done: 'Заявка уже обработана', self: 'Нельзя снять права с самого себя', 'Invalid login credentials': 'Неверный ник или пароль',
  'User already registered': 'Этот ник уже занят'
};
function errText(e) { const m = (e && (e.message || e.error_description)) || String(e); for (const k in ERR) if (m.includes(k)) return ERR[k]; return 'Ошибка: ' + m; }

/* ---------- иконки ---------- */
const IC = {
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', megaphone: '<path d="M3 10v4h3l7 4V6L6 10zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>', wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.5-8.5a4 4 0 0 0-2-2z"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>', coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.7l6.2-.9z"/>', diamond: '<path d="M6 3h12l3 6-9 12L3 9zM3 9h18M9 3l3 18M15 3l-3 18"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.7 0-2.8.9-2.8 2s1 1.7 2.8 2 2.8.9 2.8 2-1.1 2-2.8 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  car: '<path d="M4 15v-3l2-5h12l2 5v3M4 15h16v3h-3v-2H7v2H4zM6.5 12h11"/><circle cx="7.5" cy="14.5" r=".5"/><circle cx="16.5" cy="14.5" r=".5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', pin: '<path d="M9 4h6l-1 5 4 4H6l4-4zM12 13v8"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16.5 15h.01"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h10M7 17h6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', gun: '<path d="M3 9h15l3-2v5h-6l-2 3h-3l-1 4H5l1-5H3z"/>', home: '<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>', briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5h6v2M3 13h18"/>',
  tg: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z" /><path d="m9 13 8-6"/>', vk: '<path d="M3 7h3.5c.5 3 2 5 3.5 5.5V7h3v3.5C14.5 10 16 8.5 16.5 7H20c-.6 2.5-2.4 4.5-3.8 5.2 1.5.6 3.3 2.4 4 4.8h-3.8c-.6-1.8-2-3.2-3.4-3.4V17h-.5C7 17 3.8 13 3 7z"/>',
  ds: '<path d="M7 7c3-1.5 7-1.5 10 0l1.5 9c-1.8 1.5-3.5 2-3.5 2l-1-2c-2 .6-4 .6-6 0l-1 2s-1.7-.5-3.5-2zM9.5 12.5h.01M14.5 12.5h.01"/>'
};
const ic = (n, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || IC.star}</svg>`;

/* ---------- рисованные обложки новостей (без внешних картинок) ---------- */
function rng(seed) { let s = seed % 2147483647 || 7; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function skyline(w, h, seed, opts = {}) {
  const r = rng(seed); let x = 0, out = '';
  const base = opts.base || '#141419', win = opts.win || '#FFD400';
  while (x < w) {
    const bw = 30 + r() * 60, bh = h * (.25 + r() * .6), y = h - bh;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${base}"/>`;
    if (r() > .55) out += `<rect x="${(x + bw / 2 - 1).toFixed(1)}" y="${(y - 18).toFixed(1)}" width="2" height="18" fill="${base}"/>`;
    for (let wy = y + 10; wy < h - 10; wy += 14) for (let wx = x + 7; wx < x + bw - 10; wx += 12) {
      if (r() > .72) {
        const anim = opts.anim && r() > .7 ? ` class="win" style="--d:${(2 + r() * 6).toFixed(1)}s;--dl:${(r() * 5).toFixed(1)}s;--o:${r() > .5 ? 1 : .15}"` : '';
        out += `<rect${anim} x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="5" height="7" fill="${win}" opacity="${anim ? '' : (.4 + r() * .6).toFixed(2)}"/>`;
      }
    }
    x += bw + 2 + r() * 6;
  }
  return out;
}
const COVERS = {
  city: (s) => `<rect width="800" height="500" fill="#0B0B10"/><circle cx="620" cy="140" r="70" fill="#FFD400"/><g transform="translate(0,120)">${skyline(800, 380, s)}</g>`,
  crew: (s) => { let g = ''; const r = rng(s); for (let i = 0; i < 5; i++) { const x = 120 + i * 140, sc = .85 + r() * .3; g += `<g transform="translate(${x},${470 - 300 * sc}) scale(${sc})"><circle cx="0" cy="60" r="44" fill="#000"/><path d="M-80 300c0-110 30-170 80-170s80 60 80 170z" fill="#000"/></g>`; } return `<rect width="800" height="500" fill="#FFD400"/><rect y="380" width="800" height="120" fill="#E6BE00"/>${g}<rect x="40" y="40" width="160" height="10" fill="#000"/>`; },
  road: () => { let d = ''; for (let i = 0; i < 9; i++) { const y = 260 + i * i * 3.2, w = 4 + i * 2.6; d += `<rect x="${400 - w / 2}" y="${y}" width="${w}" height="${6 + i * 2}" fill="#FFD400"/>`; } return `<rect width="800" height="500" fill="#101015"/><rect y="0" width="800" height="250" fill="#1B1B22"/><path d="M360 250h80l300 250H60z" fill="#24242C"/>${d}<circle cx="400" cy="210" r="46" fill="#FFD400"/>`; },
  car: () => `<rect width="800" height="500" fill="#16161C"/><rect y="360" width="800" height="140" fill="#0D0D11"/><path d="M180 330l50-70c10-14 25-20 42-20h230c18 0 34 8 44 22l52 68h40c20 0 32 12 32 30v30H120v-30c0-34 26-30 60-30z" fill="#FFD400"/><path d="M262 260h110v62H220zM392 260h110l46 62H392z" fill="#16161C"/><circle cx="250" cy="390" r="44" fill="#000"/><circle cx="250" cy="390" r="18" fill="#3A3A42"/><circle cx="560" cy="390" r="44" fill="#000"/><circle cx="560" cy="390" r="18" fill="#3A3A42"/>`,
  neon: (s) => { const r = rng(s); let g = ''; for (let i = 0; i < 14; i++) g += `<rect x="${(r() * 800).toFixed(0)}" y="${(r() * 500).toFixed(0)}" width="${(20 + r() * 160).toFixed(0)}" height="${(4 + r() * 10).toFixed(0)}" fill="${r() > .5 ? '#FFD400' : '#fff'}" opacity="${(.2 + r() * .8).toFixed(2)}" transform="rotate(-20 400 250)"/>`; return `<rect width="800" height="500" fill="#0A0A0E"/>${g}<text x="60" y="440" font-family="Unbounded,sans-serif" font-weight="900" font-size="120" fill="none" stroke="#FFD400" stroke-width="3">HUMAN</text>`; }
};
const COVER_NAMES = { city: 'Ночной город', crew: 'Команда', road: 'Дорога', car: 'Автомобиль', neon: 'Неон' };
function coverHTML(n) {
  const c = n.cover || 'city';
  if (/^https:\/\//.test(c)) return `<img src="${esc(c)}" alt="" loading="lazy">`;
  return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">${(COVERS[c] || COVERS.city)(n.id * 97 + 13)}</svg>`;
}
const AVC = ['#FFD400', '#FFFFFF', '#FF9F0A', '#32D74B', '#64D2FF', '#BF5AF2', '#FF6482'];
function avatar(nick, cls = '') { let h = 0; for (const ch of String(nick)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `<div class="av ${cls}" style="background:${AVC[h % AVC.length]}">${esc(String(nick || '?').charAt(0).toUpperCase())}</div>`; }
const ROLE = { admin: 'Администратор', moder: 'Модератор', player: 'Игрок' };
const roleTag = r => `<span class="role ${r || 'player'}">${ROLE[r] || ROLE.player}</span>`;

/* ---------- состояние ---------- */
let me = null, S = { server: {}, pay: {} };
async function loadSettings() {
  const { data } = await sb.from('hc_settings').select('key,value');
  (data || []).forEach(r => S[r.key] = r.value || {});
  applySettings();
}
function applySettings() {
  const s = S.server || {};
  document.title = (s.name || 'HUMAN CRMP') + ' — ' + (s.slogan || 'Живи своей историей');
  $('#fslogan').textContent = (s.slogan ? s.slogan + '. ' : '') + 'Ролевой сервер Criminal Russia.';
  const soc = [['telegram', 'tg', 'Telegram'], ['vk', 'vk', 'ВКонтакте'], ['discord', 'ds', 'Discord']].filter(x => s[x[0]]);
  $('#soc').innerHTML = soc.map(x => `<a href="${esc(s[x[0]])}" target="_blank" rel="noopener" aria-label="${x[2]}">${ic(x[1], 20)}</a>`).join('');
}
async function loadMe() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { me = null; renderHeader(); return; }
  const { data } = await sb.rpc('hc_me');
  me = data || null;
  if (session && !me) {
    // аккаунт есть, а профиля нет — создаём по нику из почты
    const nick = (session.user.user_metadata && session.user.user_metadata.name) || session.user.email.split('@')[0];
    const r = await sb.rpc('hc_register', { p_nick: nick });
    me = r.data || null;
  }
  renderHeader();
}
function renderHeader() {
  const h = $('#hact');
  if (me) h.innerHTML = `<a class="bal" href="#/topup" title="Баланс">${ic('wallet', 18)}${fmtN(me.balance)} <i>₽</i></a><a class="btn sm dark" href="#/profile">${avatar(me.nick, 'sm')}<span>${esc(me.nick)}</span></a>`;
  else h.innerHTML = `<button class="btn sm ghost" data-auth="login">Войти</button><button class="btn sm" data-auth="reg">Начать играть</button>`;
}

/* ---------- вход и регистрация ---------- */
function openAuth(mode = 'login') {
  openModal(`<h3>${mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h3><p class="sub">${mode === 'login' ? 'Войдите по нику и паролю' : 'Ник будет вашим именем на форуме и в магазине'}</p>
  <div class="seg"><button class="${mode === 'login' ? 'on' : ''}" data-am="login">Вход</button><button class="${mode === 'reg' ? 'on' : ''}" data-am="reg">Регистрация</button></div>
  <form id="authF"><div class="field"><label>Игровой ник</label><input class="inp" name="nick" placeholder="Ivan_Petrov" autocomplete="username" required pattern="[A-Za-z0-9_]{3,24}"></div>
  <div class="field"><label>Пароль</label><input class="inp" name="pass" type="password" placeholder="Не меньше 6 символов" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6"></div>
  ${mode === 'reg' ? '<div class="field"><label>Повторите пароль</label><input class="inp" name="pass2" type="password" required minlength="6" autocomplete="new-password"></div><label class="chk" style="margin-bottom:16px"><input type="checkbox" name="rules" required> Я принимаю <a href="#/rules" class="y" data-close>правила сервера</a></label>' : ''}
  <div class="err" id="aerr"></div><button class="btn" style="width:100%;margin-top:6px" type="submit">${mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button></form>`);
  $('#authF').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), nick = String(f.get('nick')).trim(), pass = String(f.get('pass'));
    const err = $('#aerr'); err.textContent = '';
    if (!/^[A-Za-z0-9_]{3,24}$/.test(nick)) { err.textContent = ERR.bad_nick; return; }
    if (mode === 'reg' && pass !== f.get('pass2')) { err.textContent = 'Пароли не совпадают'; return; }
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    const email = nick.toLowerCase() + '@' + MAIL_DOMAIN;
    try {
      if (mode === 'reg') {
        const { data: ex } = await sb.from('hc_profiles').select('id').ilike('nick', nick.replace(/_/g, '\\_')).limit(1);
        if (ex && ex.length) throw new Error('nick_taken');
        const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { app: 'human', name: nick } } });
        if (error) throw error;
        let { data: s } = await sb.auth.getSession();
        if (!s.session) { const r = await sb.auth.signInWithPassword({ email, password: pass }); if (r.error) throw r.error; }
        const r = await sb.rpc('hc_register', { p_nick: nick }); if (r.error) throw r.error;
        me = r.data; toast('Добро пожаловать, ' + nick + '!');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        toast('Вы вошли как ' + nick);
      }
      closeModal(); await loadMe(); route();
    } catch (ex) { err.textContent = errText(ex); btn.disabled = false; }
  };
}
async function logout() { await sb.auth.signOut(); me = null; renderHeader(); location.hash = '#/'; toast('Вы вышли из аккаунта'); }

/* ---------- модальное окно ---------- */
function openModal(html) { $('#mc').innerHTML = html; $('#modal').classList.add('on'); document.body.classList.add('lock'); setTimeout(() => { const i = $('#mc input,#mc textarea'); if (i && matchMedia('(pointer:fine)').matches) i.focus(); }, 300); }
function closeModal() { $('#modal').classList.remove('on'); document.body.classList.remove('lock'); }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', e => {
  const a = e.target.closest('[data-auth]'); if (a) { e.preventDefault(); openAuth(a.dataset.auth); return; }
  const am = e.target.closest('[data-am]'); if (am) { openAuth(am.dataset.am); return; }
  if (e.target.closest('[data-close]')) closeModal();
  if (e.target.closest('[data-logout]')) logout();
  const cp = e.target.closest('[data-copy]'); if (cp) { navigator.clipboard.writeText(cp.dataset.copy).then(() => toast('Скопировано: ' + cp.dataset.copy), () => toast(cp.dataset.copy)); }
});

/* ---------- маршрутизация ---------- */
const app = $('#app');
let first = true, curRoute = '';
async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b, c] = h.split('/');
  const key = a || 'home';
  $$('#nav a').forEach(x => x.classList.toggle('on', x.dataset.r === key));
  $('#nav').classList.remove('open');
  const changed = curRoute !== h; curRoute = h;
  if (!first && changed) { const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); await new Promise(r => setTimeout(r, 420)); }
  first = false;
  try {
    if (key === 'home') await vHome();
    else if (key === 'news') b ? await vArticle(+b) : await vNews();
    else if (key === 'forum') b === 'c' ? await vCat(+c) : b === 't' ? await vThread(+c) : await vForum();
    else if (key === 'shop') await vShop();
    else if (key === 'topup') await vTopup();
    else if (key === 'profile') await vProfile();
    else if (key === 'rules') vRules();
    else if (key === 'admin') await vAdmin(b);
    else app.innerHTML = `<div class="page wrap"><h2 class="ttl">Страница не найдена</h2><a class="btn" style="margin-top:24px" href="#/">На главную</a></div>`;
  } catch (e) { console.error(e); app.innerHTML = `<div class="page wrap"><h2 class="ttl">Не удалось загрузить</h2><p class="sub" style="margin-top:14px">Проверьте интернет и обновите страницу.</p></div>`; }
  if (changed) window.scrollTo(0, 0);
  enhance();
}
addEventListener('hashchange', route);

/* ---------- главная ---------- */
async function vHome() {
  const s = S.server || {};
  const [news, stats, threads] = await Promise.all([
    sb.from('hc_news').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
    sb.rpc('hc_public_stats'),
    sb.from('hc_threads').select('id,title,replies,last_at,author:hc_profiles(nick)').order('last_at', { ascending: false }).limit(5)
  ]);
  const st = stats.data || {}, online = +s.online || 0, max = +s.max || 1000;
  const tick = ['Живи своей историей', 'Свой бизнес', 'Фракции и банды', 'Честная администрация', 'Работа и карьера', 'Тюнинг авто'];
  app.innerHTML = `
  <section class="hero">
    <div class="bgword" data-par=".25">HUMAN</div>
    <div class="city"><svg viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice"><g opacity=".55">${skyline(1600, 300, 11, { base: '#0D0D12' })}</g><g transform="translate(0,90)">${skyline(1600, 330, 29, { base: '#121218', anim: true })}</g></svg></div>
    <div class="wrap in">
      <div>
        <span class="tag"><i></i>Сервер работает</span>
        <h1><span class="ln"><span>Живи</span></span><span class="ln"><span>своей <span class="y">историей</span></span></span></h1>
        <p class="lead">${esc(s.name || 'HUMAN CRMP')} — ролевой сервер Criminal Russia. Устройся на работу, вступи во фракцию, открой бизнес или построй криминальную империю.</p>
        <div class="cta"><a class="btn mag" href="#/rules">Как начать играть ${ic('arrow', 20, 2.4)}</a><a class="btn ghost mag" href="#/forum">Перейти на форум</a></div>
        <div class="status">
          <div><div class="on mono"><span data-count="${online}">0</span> <small>/ ${fmtN(max)} онлайн</small></div><div class="meter"><i style="--w:${Math.min(100, online / max * 100)}%"></i></div></div>
          <button class="ipbtn" data-copy="${esc(s.ip || '')}">${ic('copy', 18)}<span>${esc(s.ip || 'IP скоро')}<br><small>Нажмите, чтобы скопировать</small></span></button>
        </div>
      </div>
      <div class="biglogo" id="biglogo"><img class="h" src="logo-h.png" alt=""><img class="r" src="logo-r.png" alt="HUMAN CRMP"><div class="slash"></div></div>
    </div>
  </section>
  <div class="ticker"><div class="tr">${[0, 1].map(() => tick.map(t => `<span>${t}${ic('star', 22, 2.6)}</span>`).join('')).join('')}</div></div>
  <div class="ticker alt"><div class="tr">${[0, 1].map(() => tick.slice().reverse().map(t => `<span>${t}${ic('bolt', 22, 2.6)}</span>`).join('')).join('')}</div></div>

  <section class="blk"><div class="wrap">
    <div class="shead"><div><div class="kicker rv">Почему мы</div><h2 class="ttl scr">Город, который живёт</h2></div></div>
    <div class="feats">${[
      ['briefcase', 'Работы и карьера', 'Дальнобойщик, таксист, инкассатор, бизнесмен — растите от стажёра до владельца компании.'],
      ['users', 'Живые фракции', 'Полиция, больница, правительство, банды и мафии. Лидеров выбирают игроки.'],
      ['home', 'Недвижимость', 'Квартиры, дома и бизнесы с настоящей экономикой и налогами.'],
      ['car', 'Тюнинг и авто', 'Сотни машин, номера, занижение, тонировка и автосалоны.'],
      ['shield', 'Честная админка', 'Жалобы рассматриваются на форуме открыто. Никаких «своих».'],
      ['bolt', 'Ивенты каждую неделю', 'Гонки, захваты территорий, праздники и розыгрыши.']
    ].map((f, i) => `<div class="feat tilt rv" style="--dl:${i * .07}s"><span class="n">0${i + 1}</span><div class="ico">${ic(f[0], 26)}</div><b>${f[1]}</b><p>${f[2]}</p></div>`).join('')}</div>
  </div></section>

  <div class="wrap"><div class="stats">
    <div class="stat rv"><b class="mono" data-count="${st.users || 0}">0</b><span>игроков на сайте</span></div>
    <div class="stat rv" style="--dl:.08s"><b class="mono" data-count="${online}">0</b><span>сейчас в игре</span></div>
    <div class="stat rv" style="--dl:.16s"><b class="mono" data-count="${st.threads || 0}">0</b><span>тем на форуме</span></div>
    <div class="stat rv" style="--dl:.24s"><b class="mono" data-count="${st.posts || 0}">0</b><span>сообщений</span></div>
  </div></div>

  <section class="blk"><div class="wrap">
    <div class="shead"><div><div class="kicker rv">Новости</div><h2 class="ttl scr">Что нового</h2></div><a class="more" href="#/news">Все новости ${ic('arrow', 18)}</a></div>
    <div class="news">${(news.data || []).map((n, i) => newsCard(n, i === 0)).join('') || '<div class="empty">Новостей пока нет</div>'}</div>
  </div></section>

  <section class="blk" style="padding-top:20px"><div class="wrap">
    <div class="shead"><div><div class="kicker rv">Старт</div><h2 class="ttl scr">Три шага до игры</h2></div></div>
    <div class="steps">
      <div class="step rv"><b>Установите игру</b><p>Скачайте лаунчер CRMP и установите клиент на компьютер или телефон.</p>${s.launcher ? `<a class="btn sm" href="${esc(s.launcher)}" target="_blank" rel="noopener">Скачать лаунчер</a>` : '<span class="pill w">Ссылка скоро</span>'}</div>
      <div class="step rv" style="--dl:.08s"><b>Создайте аккаунт</b><p>Аккаунт на сайте нужен для форума, магазина и пополнения.</p>${me ? '<span class="pill g">Готово</span>' : '<button class="btn sm" data-auth="reg">Регистрация</button>'}</div>
      <div class="step rv" style="--dl:.16s"><b>Подключитесь</b><p>Добавьте сервер по IP в избранное и заходите в игру.</p><button class="btn sm dark" data-copy="${esc(s.ip || '')}">${ic('copy', 16)} ${esc(s.ip || 'IP скоро')}</button></div>
    </div>
  </div></section>

  <section class="blk" style="padding-top:20px"><div class="wrap">
    <div class="shead"><div><div class="kicker rv">Форум</div><h2 class="ttl scr">Обсуждают сейчас</h2></div><a class="more" href="#/forum">На форум ${ic('arrow', 18)}</a></div>
    <div class="threads rv">${(threads.data || []).map(t => `<a class="thr" href="#/forum/t/${t.id}"><div><b>${esc(t.title)}</b><div class="m">${esc(t.author ? t.author.nick : '')} · ${ago(t.last_at)}</div></div><div class="c">${t.replies} ответов</div><div class="c lastc">${ic('arrow', 18)}</div></a>`).join('') || '<div class="empty">Будьте первым — создайте тему на форуме</div>'}</div>
  </div></section>

  <section class="blk" style="padding-top:20px"><div class="wrap"><div class="box rv" style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding:40px;background:var(--y);color:#000;border:0">
    <div><h2 class="ttl" style="margin:0;color:#000">Поддержите сервер</h2><p style="font-weight:600;margin-top:10px;max-width:520px">VIP-статусы, игровая валюта и транспорт. Каждая покупка помогает проекту развиваться.</p></div>
    <a class="btn mag" href="#/shop" style="background:#000;color:#fff">Открыть магазин ${ic('arrow', 20, 2.4)}</a>
  </div></div></section>`;
  setTimeout(() => $$('.status .meter i').forEach(i => i.style.width = i.style.getPropertyValue('--w')), 500);
}
function newsCard(n, big) {
  return `<a class="ncard rv${big ? ' big' : ''}" href="#/news/${n.id}"><div class="cv">${coverHTML(n)}</div><div class="nb"><div class="meta"><span class="pill">${esc(n.tag)}</span>${n.pinned ? `<span class="pill w">${ic('pin', 13)} Закреплено</span>` : ''}<span>${fdate(n.created_at)}</span></div><h3>${esc(n.title)}</h3><p>${esc(String(n.body).replace(/\s+/g, ' ').slice(0, 220))}</p></div></a>`;
}

/* ---------- новости ---------- */
async function vNews() {
  const { data } = await sb.from('hc_news').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60);
  app.innerHTML = `<div class="page"><div class="wrap"><div class="shead"><div><div class="kicker rv">Блог проекта</div><h2 class="ttl scr">Новости</h2></div></div>
  <div class="news">${(data || []).map((n, i) => newsCard(n, i === 0)).join('') || '<div class="empty">Новостей пока нет</div>'}</div></div></div>`;
}
async function vArticle(id) {
  const { data: n } = await sb.from('hc_news').select('*').eq('id', id).maybeSingle();
  if (!n) { app.innerHTML = '<div class="page wrap"><h2 class="ttl">Новость не найдена</h2></div>'; return; }
  app.innerHTML = `<div class="page"><div class="wrap"><article class="art"><a class="back" href="#/news">${ic('back', 18)} Все новости</a>
  <div class="meta" style="display:flex;gap:10px;align-items:center;color:var(--sub);font-size:14px;margin-bottom:14px"><span class="pill">${esc(n.tag)}</span>${fdate(n.created_at)}</div>
  <h1 class="scr">${esc(n.title)}</h1><div class="cv rvc">${coverHTML(n)}</div><div class="prose rv">${paras(n.body)}</div></article></div></div>`;
}

/* ---------- форум ---------- */
async function vForum() {
  const [cats, thr] = await Promise.all([
    sb.from('hc_cats').select('*').order('sort'),
    sb.from('hc_threads').select('id,cat_id,title,last_at,replies,author:hc_profiles(nick)').order('last_at', { ascending: false }).limit(1000)
  ]);
  const by = {}; (thr.data || []).forEach(t => (by[t.cat_id] = by[t.cat_id] || []).push(t));
  app.innerHTML = `<div class="page"><div class="wrap"><div class="shead"><div><div class="kicker rv">Сообщество</div><h2 class="ttl scr">Форум</h2></div>${me ? '' : '<button class="btn sm" data-auth="login">Войти, чтобы писать</button>'}</div>
  <div class="fcats">${(cats.data || []).map((c, i) => {
    const l = by[c.id] || [], last = l[0], posts = l.reduce((s, t) => s + 1 + t.replies, 0);
    return `<a class="fcat rv" style="--dl:${i * .05}s" href="#/forum/c/${c.id}"><div class="fi">${ic(c.icon, 26)}</div><div><b>${esc(c.title)}</b><div class="d">${esc(c.descr)}</div></div><div class="c"><b class="mono">${l.length}</b><br>тем · ${posts} сообщ.</div><div class="last">${last ? `<span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:var(--fg)">${esc(last.title)}</span>${esc(last.author ? last.author.nick : '')} · ${ago(last.last_at)}` : 'Тем пока нет'}</div></a>`;
  }).join('')}</div></div></div>`;
}
async function vCat(id) {
  const [cat, thr] = await Promise.all([
    sb.from('hc_cats').select('*').eq('id', id).maybeSingle(),
    sb.from('hc_threads').select('id,title,pinned,locked,replies,created_at,last_at,author:hc_profiles(nick,role)').eq('cat_id', id).order('pinned', { ascending: false }).order('last_at', { ascending: false }).limit(200)
  ]);
  const c = cat.data; if (!c) { app.innerHTML = '<div class="page wrap"><h2 class="ttl">Раздел не найден</h2></div>'; return; }
  const canPost = me && !me.banned && (!c.staff_only || ['admin', 'moder'].includes(me.role));
  app.innerHTML = `<div class="page"><div class="wrap"><a class="back" href="#/forum">${ic('back', 18)} Форум</a><div class="shead"><div><h2 class="ttl scr" style="margin:0">${esc(c.title)}</h2><p class="sub" style="margin-top:10px">${esc(c.descr)}</p></div>
  ${canPost ? `<button class="btn mag" id="newT">${ic('plus', 20, 2.6)} Новая тема</button>` : me ? '' : '<button class="btn sm" data-auth="login">Войти, чтобы создать тему</button>'}</div>
  <div class="threads rv">${(thr.data || []).map(t => `<a class="thr" href="#/forum/t/${t.id}"><div><b>${t.pinned ? `<span class="y">${ic('pin', 16)}</span>` : ''}${t.locked ? `<span class="sub">${ic('lock', 16)}</span>` : ''}${esc(t.title)}</b><div class="m">${esc(t.author ? t.author.nick : '')} · ${fdate(t.created_at)}</div></div><div class="c"><b class="mono" style="color:var(--fg);font-size:16px">${t.replies}</b><br>ответов</div><div class="c lastc">${ago(t.last_at)}</div></a>`).join('') || '<div class="empty">В этом разделе пока нет тем</div>'}</div></div></div>`;
  const nb = $('#newT'); if (nb) nb.onclick = () => {
    openModal(`<h3>Новая тема</h3><p class="sub" style="margin-bottom:18px">${esc(c.title)}</p><form id="tf"><div class="field"><label>Заголовок</label><input class="inp" name="title" maxlength="120" required minlength="3"></div><div class="field"><label>Сообщение</label><textarea class="inp" name="body" rows="7" required maxlength="20000" placeholder="Опишите подробно. Для жалобы приложите ссылки на доказательства."></textarea></div><div class="err" id="terr"></div><button class="btn" style="width:100%">Опубликовать</button></form>`);
    $('#tf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      const { data, error } = await sb.from('hc_threads').insert({ cat_id: id, title: String(f.get('title')).trim(), body: String(f.get('body')).trim() }).select('id').single();
      if (error) { $('#terr').textContent = errText(error); return; }
      closeModal(); location.hash = '#/forum/t/' + data.id;
    };
  };
}
async function vThread(id) {
  const [t, p] = await Promise.all([
    sb.from('hc_threads').select('*,au:hc_profiles(nick,role,created_at),cat:hc_cats(id,title)').eq('id', id).maybeSingle(),
    sb.from('hc_posts').select('*,au:hc_profiles(nick,role,created_at)').eq('thread_id', id).order('created_at').limit(500)
  ]);
  const th = t.data; if (!th) { app.innerHTML = '<div class="page wrap"><h2 class="ttl">Тема не найдена</h2></div>'; return; }
  const staff = me && ['admin', 'moder'].includes(me.role);
  const postHTML = (x, isTopic) => `<div class="post rv"><div class="au">${avatar(x.au ? x.au.nick : '?')}<div><b>${esc(x.au ? x.au.nick : 'Удалён')}</b>${roleTag(x.au && x.au.role)}</div></div><div class="pb"><div class="pm"><span>${fdate(x.created_at)} · ${new Date(x.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>${(staff || (me && x.author === me.id)) && !isTopic ? `<button class="sub" data-delpost="${x.id}" title="Удалить">${ic('trash', 18)}</button>` : ''}</div><div class="tx">${rich(x.body)}</div></div></div>`;
  app.innerHTML = `<div class="page"><div class="wrap"><a class="back" href="#/forum/c/${th.cat ? th.cat.id : ''}">${ic('back', 18)} ${esc(th.cat ? th.cat.title : 'Форум')}</a>
  <div class="shead" style="margin-bottom:24px"><h2 class="ttl scr" style="margin:0;font-size:clamp(26px,3.4vw,40px)">${esc(th.title)}</h2>
  ${staff ? `<div class="acts"><button class="btn sm dark" data-tact="pin">${ic('pin', 16)} ${th.pinned ? 'Открепить' : 'Закрепить'}</button><button class="btn sm dark" data-tact="lock">${ic('lock', 16)} ${th.locked ? 'Открыть' : 'Закрыть'}</button><button class="btn sm red" data-tact="del">${ic('trash', 16)} Удалить</button></div>` : ''}</div>
  ${postHTML(th, true)}${(p.data || []).map(x => postHTML(x)).join('')}
  ${th.locked && !staff ? `<div class="box" style="text-align:center;color:var(--sub)">${ic('lock', 22)} Тема закрыта</div>`
      : me ? (me.banned ? '<div class="box sub">Аккаунт заблокирован</div>' : `<form class="box rv" id="rf" style="margin-top:20px"><div class="field"><label>Ваш ответ</label><textarea class="inp" name="body" rows="5" required maxlength="20000"></textarea></div><div class="err" id="rerr"></div><button class="btn">Отправить ${ic('arrow', 18, 2.4)}</button></form>`)
        : `<div class="box" style="text-align:center;margin-top:20px"><p class="sub" style="margin-bottom:14px">Войдите, чтобы ответить</p><button class="btn" data-auth="login">Войти</button></div>`}
  </div></div>`;
  const rf = $('#rf'); if (rf) rf.onsubmit = async e => {
    e.preventDefault(); const body = String(new FormData(rf).get('body')).trim(); if (!body) return;
    const { error } = await sb.from('hc_posts').insert({ thread_id: id, body });
    if (error) { $('#rerr').textContent = errText(error); return; }
    curRoute = ''; route();
  };
  $$('[data-delpost]').forEach(b => b.onclick = async () => { if (!await confirmBox('Удалить сообщение?')) return; await sb.from('hc_posts').delete().eq('id', +b.dataset.delpost); curRoute = 'x'; route(); });
  $$('[data-tact]').forEach(b => b.onclick = async () => {
    const a = b.dataset.tact;
    if (a === 'del') { if (!await confirmBox('Удалить тему со всеми ответами?')) return; await sb.from('hc_threads').delete().eq('id', id); location.hash = '#/forum/c/' + th.cat_id; return; }
    const patch = a === 'pin' ? { pinned: !th.pinned } : { locked: !th.locked };
    const { error } = await sb.from('hc_threads').update(patch).eq('id', id);
    if (error) toast(errText(error), 1); else { curRoute = 'x'; route(); }
  });
}
function confirmBox(text) {
  return new Promise(res => {
    openModal(`<h3 style="font-size:22px">${esc(text)}</h3><p class="sub" style="margin-bottom:22px">Действие нельзя отменить.</p><div class="row2"><button class="btn dark" id="cNo">Отмена</button><button class="btn red" id="cYes">Да</button></div>`);
    $('#cNo').onclick = () => { closeModal(); res(false); }; $('#cYes').onclick = () => { closeModal(); res(true); };
  });
}

/* ---------- магазин ---------- */
let shopCat = 'Все';
async function vShop() {
  const { data } = await sb.from('hc_products').select('*').eq('active', true).order('sort');
  const prods = data || [], cats = ['Все', ...new Set(prods.map(p => p.category))];
  const draw = () => {
    $('#shopG').innerHTML = prods.filter(p => shopCat === 'Все' || p.category === shopCat).map((p, i) => `<div class="prod tilt rv" style="--dl:${(i % 4) * .06}s">${p.badge ? `<span class="pill bd">${esc(p.badge)}</span>` : ''}<div class="pi">${ic(p.icon, 30)}</div><b>${esc(p.title)}</b><p>${esc(p.descr)}</p><div class="pr"><span class="price mono">${fmtN(p.price)} <small>₽</small></span><button class="btn sm" data-buy="${p.id}">Купить</button></div></div>`).join('') || '<div class="empty">Товаров пока нет</div>';
    $$('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.c === shopCat));
    enhance();
  };
  app.innerHTML = `<div class="page"><div class="wrap"><div class="shead"><div><div class="kicker rv">Донат</div><h2 class="ttl scr">Магазин</h2></div>
  ${me ? `<div class="bal" style="height:52px;font-size:17px;padding:0 18px">${ic('wallet', 20)} Баланс: ${fmtN(me.balance)} <i>₽</i><a class="btn sm" href="#/topup" style="margin-left:8px">Пополнить</a></div>` : '<button class="btn sm" data-auth="login">Войдите, чтобы покупать</button>'}</div>
  <div class="tabs" id="shopTabs">${cats.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="shop" id="shopG"></div>
  <p class="sub" style="margin-top:28px;font-size:14px">Покупка списывается с баланса сайта. Товар выдаётся на указанный игровой ник — обычно в течение 24 часов. Возврат — по обращению на форуме.</p></div></div>`;
  $('#shopTabs').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { shopCat = b.dataset.c; draw(); } };
  $('#shopG').onclick = e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    if (!me) { openAuth('login'); return; }
    const p = prods.find(x => x.id === +b.dataset.buy);
    openModal(`<h3>${esc(p.title)}</h3><p class="sub" style="margin-bottom:18px">${esc(p.descr)}</p><div class="box" style="padding:18px;margin-bottom:18px;display:flex;justify-content:space-between"><span>Цена</span><b class="mono">${fmtN(p.price)} ₽</b></div>
    <form id="bf"><div class="field"><label>Игровой ник получателя</label><input class="inp" name="gn" value="${esc(me.nick)}" required pattern="[A-Za-z0-9_]{3,24}"></div><div class="err" id="berr"></div>
    ${me.balance < p.price ? `<p class="sub" style="margin-bottom:12px">На балансе ${fmtN(me.balance)} ₽ — не хватает ${fmtN(p.price - me.balance)} ₽.</p><a class="btn" style="width:100%" href="#/topup" data-close>Пополнить баланс</a>` : `<button class="btn" style="width:100%">Оплатить ${fmtN(p.price)} ₽</button>`}</form>`);
    $('#bf').onsubmit = async e => {
      e.preventDefault(); const gn = String(new FormData(e.target).get('gn')).trim();
      const { data, error } = await sb.rpc('hc_buy', { p_product: p.id, p_game_nick: gn });
      if (error) { $('#berr').textContent = errText(error); return; }
      me = data; renderHeader(); closeModal(); toast('Покупка оформлена: ' + p.title); vShop().then(enhance);
    };
  };
  draw();
}

/* ---------- пополнение ---------- */
async function vTopup() {
  if (!me) { app.innerHTML = `<div class="page"><div class="wrap" style="max-width:640px;text-align:center"><div class="kicker rv" style="justify-content:center">Баланс</div><h2 class="ttl scr">Пополнение</h2><p class="sub" style="margin:18px 0 26px">Войдите в аккаунт, чтобы пополнить баланс.</p><button class="btn" data-auth="login">Войти</button> <button class="btn ghost" data-auth="reg">Регистрация</button></div></div>`; return; }
  const pay = S.pay || {};
  app.innerHTML = `<div class="page"><div class="wrap" style="max-width:760px"><div class="kicker rv">Баланс: ${fmtN(me.balance)} ₽</div><h2 class="ttl scr">Пополнить баланс</h2>
  <form class="box rv" id="pf" style="margin-top:30px"><div class="field"><label>Сумма</label></div><div class="amounts">${[100, 300, 500, 1000, 3000].map(a => `<button type="button" data-a="${a}">${fmtN(a)} ₽</button>`).join('')}</div>
  <div class="field"><label>Или своя сумма, ₽</label><input class="inp mono" name="amount" type="number" min="10" max="100000" value="300" required></div>
  <div class="field"><label>Реквизиты для оплаты</label><div class="req">${pay.card ? `<b class="mono" style="font-size:18px">${esc(pay.card)}</b>${pay.holder ? '\n' + esc(pay.holder) : ''}\n\n` : ''}${esc(pay.note || 'Реквизиты скоро появятся.')}${pay.card ? `\nКомментарий к переводу: <b class="y">${esc(me.nick)}</b>` : ''}</div></div>
  <div class="field"><label>Как оплатили и детали перевода</label><input class="inp" name="comment" maxlength="300" placeholder="Например: перевод с карты *1234 в 18:40"></div>
  <div class="err" id="perr"></div><button class="btn" style="width:100%">Я оплатил — отправить заявку</button><p class="sub" style="font-size:14px;margin-top:14px">Баланс пополнится после проверки платежа администратором.</p></form>
  <h3 style="margin:40px 0 14px;font-size:20px">Мои заявки</h3><div class="box" style="padding:8px 14px" id="myT"><div class="empty">Загрузка…</div></div></div></div>`;
  const amt = $('#pf [name=amount]');
  const mark = () => $$('.amounts button').forEach(b => b.classList.toggle('on', +b.dataset.a === +amt.value));
  $('.amounts').onclick = e => { const b = e.target.closest('[data-a]'); if (b) { amt.value = b.dataset.a; mark(); } };
  amt.oninput = mark; mark();
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const { error } = await sb.from('hc_topups').insert({ amount: +f.get('amount'), comment: String(f.get('comment') || '').trim() });
    if (error) { $('#perr').textContent = errText(error); return; }
    toast('Заявка отправлена — ждите подтверждения'); e.target.reset(); amt.value = 300; mark(); loadMyTopups();
  };
  loadMyTopups();
}
const TST = { pending: ['На проверке', 'w'], approved: ['Зачислено', 'g'], rejected: ['Отклонено', 'r'] };
async function loadMyTopups() {
  const { data } = await sb.from('hc_topups').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(30);
  const el = $('#myT'); if (!el) return;
  el.innerHTML = (data || []).length ? `<table class="tbl"><tr><th>Дата</th><th>Сумма</th><th>Статус</th></tr>${data.map(t => `<tr><td>${fdate(t.created_at)}</td><td class="mono">${fmtN(t.amount)} ₽</td><td><span class="pill ${TST[t.status][1]}">${TST[t.status][0]}</span></td></tr>`).join('')}</table>` : '<div class="empty">Заявок пока нет</div>';
}

/* ---------- профиль ---------- */
async function vProfile() {
  if (!me) { app.innerHTML = `<div class="page"><div class="wrap" style="text-align:center"><h2 class="ttl scr">Личный кабинет</h2><p class="sub" style="margin:18px 0 26px">Войдите, чтобы открыть кабинет.</p><button class="btn" data-auth="login">Войти</button></div></div>`; return; }
  const [o, t] = await Promise.all([
    sb.from('hc_orders').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50),
    sb.from('hc_threads').select('id,title,replies,created_at').eq('author', me.id).order('created_at', { ascending: false }).limit(20)
  ]);
  const OST = { paid: ['Ожидает выдачи', 'w'], delivered: ['Выдано', 'g'], refunded: ['Возврат', 'r'] };
  app.innerHTML = `<div class="page"><div class="wrap"><div class="prof">
  <div class="pcard rv">${avatar(me.nick)}<h3>${esc(me.nick)}</h3>${roleTag(me.role)}<p class="sub" style="font-size:14px;margin-top:10px">На сайте с ${fdate(me.created_at)}</p>
  <div class="bl"><span style="font-weight:700;font-size:14px">Баланс</span><b class="mono">${fmtN(me.balance)} ₽</b></div>
  <a class="btn" href="#/topup" style="width:100%">Пополнить</a>${me.role === 'admin' ? `<a class="btn dark" href="#/admin" style="width:100%;margin-top:10px">${ic('gear', 18)} Панель управления</a>` : ''}<button class="btn ghost" data-logout style="width:100%;margin-top:10px">${ic('logout', 18)} Выйти</button></div>
  <div>
    <div class="box rv"><h3 style="font-size:20px;margin-bottom:10px">Покупки</h3>${(o.data || []).length ? `<table class="tbl"><tr><th>Товар</th><th>Ник</th><th>Сумма</th><th>Статус</th></tr>${o.data.map(x => `<tr><td><b>${esc(x.title)}</b><div class="sub" style="font-size:13px">${fdate(x.created_at)}</div></td><td>${esc(x.game_nick)}</td><td class="mono">${fmtN(x.price)} ₽</td><td><span class="pill ${OST[x.status][1]}">${OST[x.status][0]}</span></td></tr>`).join('')}</table>` : '<div class="empty">Покупок пока нет — <a class="y" href="#/shop">загляните в магазин</a></div>'}</div>
    <div class="box rv" style="margin-top:16px"><h3 style="font-size:20px;margin-bottom:10px">Мои темы</h3>${(t.data || []).length ? t.data.map(x => `<a class="thr" style="grid-template-columns:1fr 100px;padding:12px 4px" href="#/forum/t/${x.id}"><b>${esc(x.title)}</b><span class="c">${x.replies} ответов</span></a>`).join('') : '<div class="empty">Тем пока нет</div>'}</div>
  </div></div></div></div>`;
}

/* ---------- правила ---------- */
function vRules() {
  const s = S.server || {};
  app.innerHTML = `<div class="page"><div class="wrap" style="max-width:860px"><div class="kicker rv">Обязательно к прочтению</div><h2 class="ttl scr">Правила и старт</h2>
  <div class="box rv" style="margin-top:30px"><h3 style="font-size:20px;margin-bottom:14px">Как начать играть</h3><div class="prose" style="font-size:16px"><p>1. Установите клиент CRMP${s.launcher ? ` — <a href="${esc(s.launcher)}" target="_blank" rel="noopener">скачать лаунчер</a>` : ''}.</p><p>2. Добавьте сервер в избранное: <b class="y">${esc(s.ip || 'IP скоро')}</b>.</p><p>3. Зарегистрируйтесь в игре, используя ник формата Имя_Фамилия.</p></div></div>
  <div class="box rv" style="margin-top:16px"><h3 style="font-size:20px;margin-bottom:14px">Правила сервера</h3><div class="prose" style="font-size:16px">${paras(s.rules || 'Правила скоро появятся.')}</div></div></div></div>`;
}

/* ---------- скрытая панель управления ---------- */
let admTab = 'stats';
async function vAdmin(tab) {
  if (tab) admTab = tab;
  if (!me) { app.innerHTML = `<div class="page"><div class="wrap" style="max-width:520px;text-align:center"><h2 class="ttl scr">Панель управления</h2><p class="sub" style="margin:18px 0 24px">Войдите аккаунтом администратора.</p><button class="btn" data-auth="login">Войти</button></div></div>`; return; }
  if (me.role !== 'admin') {
    app.innerHTML = `<div class="page"><div class="wrap" style="max-width:560px;text-align:center"><h2 class="ttl scr">Нет доступа</h2>${!me.has_admin ? `<p class="sub" style="margin:18px 0 24px">Администратор ещё не назначен. Первый, кто нажмёт кнопку, станет владельцем панели.</p><button class="btn" id="claim">Стать администратором</button>` : '<p class="sub" style="margin-top:18px">Этот раздел только для администрации.</p>'}</div></div>`;
    const c = $('#claim'); if (c) c.onclick = async () => { const { data, error } = await sb.rpc('hc_claim_admin'); if (error) { toast(errText(error), 1); return; } me = data; toast('Вы — администратор HUMAN CRMP'); route(); };
    return;
  }
  const { data: st } = await sb.rpc('hc_admin_stats');
  const tabs = [['stats', 'grid', 'Обзор'], ['topups', 'wallet', 'Пополнения', st && st.pending], ['orders', 'box', 'Заказы'], ['users', 'users', 'Игроки'], ['news', 'news', 'Новости'], ['products', 'cart', 'Магазин'], ['forum', 'chat', 'Разделы форума'], ['settings', 'gear', 'Настройки']];
  app.innerHTML = `<div class="page"><div class="wrap"><div class="shead" style="margin-bottom:24px"><div><div class="kicker">Только для администрации</div><h2 class="ttl" style="font-size:40px">Панель управления</h2></div></div>
  <div class="adm"><div class="aside">${tabs.map(t => `<button class="${admTab === t[0] ? 'on' : ''}" data-at="${t[0]}">${ic(t[1], 18)}${t[2]}${t[3] ? `<span class="cnt">${t[3]}</span>` : ''}</button>`).join('')}</div><div id="admB"></div></div></div></div>`;
  $('.aside').onclick = e => { const b = e.target.closest('[data-at]'); if (b) { admTab = b.dataset.at; $$('.aside button').forEach(x => x.classList.toggle('on', x === b)); admRender(st); } };
  admRender(st);
}
async function admRender(st) {
  const B = $('#admB'); B.innerHTML = '<div class="empty">Загрузка…</div>';
  const reload = () => vAdmin().then(enhance);
  if (admTab === 'stats') {
    B.innerHTML = `<div class="kpis">${[['Игроков', st.users], ['Новых за неделю', st.users_week], ['Зачислено, ₽', st.revenue], ['Заказов', st.orders], ['Заявок ждут', st.pending], ['Тем на форуме', st.threads], ['Ответов', st.posts], ['Онлайн (вручную)', (S.server || {}).online || 0]].map(k => `<div class="kpi"><span>${k[0]}</span><b class="mono">${fmtN(k[1])}</b></div>`).join('')}</div>
    <div class="box"><b>Как попасть сюда</b><p class="sub" style="margin-top:6px;font-size:15px">Ссылки на панель на сайте нет. Откройте адрес сайта с окончанием <b class="y">#/admin</b> или 5 раз нажмите на логотип внизу страницы. Пускает только аккаунты с ролью «Администратор».</p></div>`;
  }
  if (admTab === 'topups') {
    const { data } = await sb.from('hc_topups').select('*,user:hc_profiles(nick)').order('status').order('created_at', { ascending: false }).limit(200);
    const l = (data || []).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
    B.innerHTML = `<div class="box" style="padding:10px 16px">${l.length ? `<table class="tbl"><tr><th>Игрок</th><th>Сумма</th><th>Комментарий</th><th>Статус</th><th></th></tr>${l.map(t => `<tr><td><b>${esc(t.user ? t.user.nick : '')}</b><div class="sub" style="font-size:12px">${ago(t.created_at)}</div></td><td class="mono"><b>${fmtN(t.amount)} ₽</b></td><td class="sub" style="font-size:14px;max-width:260px">${esc(t.comment)}</td><td><span class="pill ${TST[t.status][1]}">${TST[t.status][0]}</span></td><td>${t.status === 'pending' ? `<div class="acts"><button class="btn sm green" data-tp="${t.id}" data-ok="1">${ic('check', 16, 2.6)}</button><button class="btn sm red" data-tp="${t.id}" data-ok="0">${ic('x', 16, 2.6)}</button></div>` : ''}</td></tr>`).join('')}</table>` : '<div class="empty">Заявок нет</div>'}</div>`;
    B.onclick = async e => { const b = e.target.closest('[data-tp]'); if (!b) return; const { error } = await sb.rpc('hc_topup_decide', { p_id: +b.dataset.tp, p_approve: b.dataset.ok === '1' }); if (error) toast(errText(error), 1); else { toast(b.dataset.ok === '1' ? 'Баланс зачислен' : 'Заявка отклонена'); reload(); } };
  }
  if (admTab === 'orders') {
    const { data } = await sb.from('hc_orders').select('*,user:hc_profiles(nick)').order('created_at', { ascending: false }).limit(200);
    const OST = { paid: ['Выдать', 'w'], delivered: ['Выдано', 'g'], refunded: ['Возврат', 'r'] };
    B.innerHTML = `<div class="box" style="padding:10px 16px">${(data || []).length ? `<table class="tbl"><tr><th>Товар</th><th>Аккаунт → игровой ник</th><th>Сумма</th><th>Статус</th></tr>${data.map(o => `<tr><td><b>${esc(o.title)}</b><div class="sub" style="font-size:12px">${ago(o.created_at)}</div></td><td>${esc(o.user ? o.user.nick : '')} → <b class="y">${esc(o.game_nick)}</b></td><td class="mono">${fmtN(o.price)} ₽</td><td>${o.status === 'paid' ? `<button class="btn sm" data-od="${o.id}">${ic('check', 16, 2.6)} Отметить выданным</button>` : `<span class="pill ${OST[o.status][1]}">${OST[o.status][0]}</span>`}</td></tr>`).join('')}</table>` : '<div class="empty">Заказов пока нет</div>'}</div>`;
    B.onclick = async e => { const b = e.target.closest('[data-od]'); if (!b) return; const { error } = await sb.from('hc_orders').update({ status: 'delivered' }).eq('id', +b.dataset.od); if (error) toast(errText(error), 1); else { toast('Отмечено как выданное'); admRender(st); } };
  }
  if (admTab === 'users') {
    B.innerHTML = `<input class="inp" id="uq" placeholder="Поиск по нику" style="margin-bottom:14px"><div class="box" style="padding:10px 16px" id="ul"></div>`;
    const load = async () => {
      const { data, error } = await sb.rpc('hc_admin_users', { p_q: $('#uq').value.trim() });
      if (error) { $('#ul').innerHTML = `<div class="empty">${errText(error)}</div>`; return; }
      $('#ul').innerHTML = `<table class="tbl"><tr><th>Ник</th><th>Роль</th><th>Баланс</th><th>Потратил</th><th></th></tr>${(data || []).map(u => `<tr><td><b>${esc(u.nick)}</b>${u.banned ? ' <span class="pill r">Бан</span>' : ''}<div class="sub" style="font-size:12px">${fdate(u.created_at)}</div></td><td><select class="inp" style="height:38px;width:150px;padding:0 10px" data-role="${u.id}">${['player', 'moder', 'admin'].map(r => `<option value="${r}"${u.role === r ? ' selected' : ''}>${ROLE[r]}</option>`).join('')}</select></td><td class="mono">${fmtN(u.balance)} ₽</td><td class="mono">${fmtN(u.spent)} ₽</td><td><div class="acts"><button class="btn sm dark" data-bal="${u.id}" data-n="${esc(u.nick)}">${ic('wallet', 16)}</button><button class="btn sm ${u.banned ? 'green' : 'red'}" data-ban="${u.id}" data-b="${u.banned ? 0 : 1}">${u.banned ? 'Разбан' : 'Бан'}</button></div></td></tr>`).join('')}</table>`;
    };
    let qt; $('#uq').oninput = () => { clearTimeout(qt); qt = setTimeout(load, 300); };
    B.onchange = async e => { const s = e.target.closest('[data-role]'); if (!s) return; const { error } = await sb.rpc('hc_admin_user', { p_user: s.dataset.role, p_role: s.value, p_banned: null }); toast(error ? errText(error) : 'Роль изменена', !!error); };
    B.onclick = async e => {
      const bn = e.target.closest('[data-ban]'); if (bn) { const { error } = await sb.rpc('hc_admin_user', { p_user: bn.dataset.ban, p_role: null, p_banned: bn.dataset.b === '1' }); toast(error ? errText(error) : 'Готово', !!error); load(); return; }
      const bl = e.target.closest('[data-bal]'); if (bl) {
        openModal(`<h3>Баланс: ${esc(bl.dataset.n)}</h3><p class="sub" style="margin-bottom:18px">Положительное число — начислить, отрицательное — списать.</p><form id="balF"><div class="field"><label>Сумма, ₽</label><input class="inp mono" name="d" type="number" required placeholder="500 или -200"></div><div class="err" id="berr"></div><button class="btn" style="width:100%">Применить</button></form>`);
        $('#balF').onsubmit = async ev => { ev.preventDefault(); const d = +new FormData(ev.target).get('d'); const { error } = await sb.rpc('hc_admin_balance', { p_user: bl.dataset.bal, p_delta: d }); if (error) { $('#berr').textContent = errText(error); return; } closeModal(); toast('Баланс изменён'); load(); if (bl.dataset.bal === me.id) loadMe(); };
      }
    };
    load();
  }
  if (admTab === 'news') {
    const { data } = await sb.from('hc_news').select('*').order('created_at', { ascending: false });
    B.innerHTML = `<button class="btn" id="nNew" style="margin-bottom:14px">${ic('plus', 18, 2.6)} Новая новость</button><div class="box" style="padding:10px 16px">${(data || []).map(n => `<div class="thr" style="grid-template-columns:1fr auto;padding:14px 6px"><div><b>${n.pinned ? `<span class="y">${ic('pin', 16)}</span>` : ''}${esc(n.title)}</b><div class="m">${esc(n.tag)} · ${fdate(n.created_at)}</div></div><div class="acts"><button class="btn sm dark" data-ne="${n.id}">${ic('pen', 16)}</button><button class="btn sm red" data-nd="${n.id}">${ic('trash', 16)}</button></div></div>`).join('') || '<div class="empty">Новостей нет</div>'}</div>`;
    const form = n => {
      n = n || { title: '', body: '', tag: 'Новость', cover: 'city', pinned: false };
      openModal(`<h3>${n.id ? 'Изменить новость' : 'Новая новость'}</h3><form id="nf" style="margin-top:16px"><div class="field"><label>Заголовок</label><input class="inp" name="title" value="${esc(n.title)}" required minlength="3" maxlength="140"></div>
      <div class="row2"><div class="field"><label>Метка</label><input class="inp" name="tag" value="${esc(n.tag)}" maxlength="30"></div><div class="field"><label>Обложка</label><select class="inp" name="cover">${Object.keys(COVERS).map(k => `<option value="${k}"${n.cover === k ? ' selected' : ''}>${COVER_NAMES[k]}</option>`).join('')}<option value="url"${/^https/.test(n.cover) ? ' selected' : ''}>Своя картинка (ссылка)</option></select></div></div>
      <div class="field"><label>Ссылка на картинку (если «своя»)</label><input class="inp" name="url" value="${/^https/.test(n.cover) ? esc(n.cover) : ''}" placeholder="https://…"></div>
      <div class="field"><label>Текст (пустая строка — новый абзац, **жирный**)</label><textarea class="inp" name="body" rows="8">${esc(n.body)}</textarea></div><label class="chk" style="margin-bottom:16px"><input type="checkbox" name="pinned"${n.pinned ? ' checked' : ''}> Закрепить наверху</label><div class="err" id="nerr"></div><button class="btn" style="width:100%">Сохранить</button></form>`);
      $('#nf').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        const cover = f.get('cover') === 'url' ? String(f.get('url')).trim() : f.get('cover');
        if (f.get('cover') === 'url' && !/^https:\/\//.test(cover)) { $('#nerr').textContent = 'Ссылка должна начинаться с https://'; return; }
        const row = { title: String(f.get('title')).trim(), tag: String(f.get('tag')).trim() || 'Новость', cover, body: String(f.get('body')), pinned: !!f.get('pinned') };
        const q = n.id ? sb.from('hc_news').update(row).eq('id', n.id) : sb.from('hc_news').insert(Object.assign(row, { author: me.id }));
        const { error } = await q; if (error) { $('#nerr').textContent = errText(error); return; }
        closeModal(); toast('Новость сохранена'); admRender(st);
      };
    };
    $('#nNew').onclick = () => form();
    B.onclick = async e => {
      const ed = e.target.closest('[data-ne]'); if (ed) form((data || []).find(x => x.id === +ed.dataset.ne));
      const dl = e.target.closest('[data-nd]'); if (dl && await confirmBox('Удалить новость?')) { await sb.from('hc_news').delete().eq('id', +dl.dataset.nd); admRender(st); }
    };
  }
  if (admTab === 'products') {
    const { data } = await sb.from('hc_products').select('*').order('sort');
    B.innerHTML = `<button class="btn" id="pNew" style="margin-bottom:14px">${ic('plus', 18, 2.6)} Новый товар</button><div class="box" style="padding:10px 16px"><table class="tbl"><tr><th>Товар</th><th>Категория</th><th>Цена</th><th></th></tr>${(data || []).map(p => `<tr style="${p.active ? '' : 'opacity:.45'}"><td><div style="display:flex;gap:12px;align-items:center"><span class="y">${ic(p.icon, 20)}</span><b>${esc(p.title)}</b>${p.badge ? `<span class="pill">${esc(p.badge)}</span>` : ''}</div></td><td class="sub">${esc(p.category)}</td><td class="mono">${fmtN(p.price)} ₽</td><td><div class="acts"><button class="btn sm dark" data-pe="${p.id}">${ic('pen', 16)}</button><button class="btn sm red" data-pd="${p.id}">${ic('trash', 16)}</button></div></td></tr>`).join('')}</table></div>`;
    const icons = ['star', 'crown', 'diamond', 'coin', 'car', 'pen', 'shield', 'box', 'gun', 'home', 'bolt', 'briefcase'];
    const form = p => {
      p = p || { title: '', descr: '', price: 100, category: 'Статусы', badge: '', icon: 'star', active: true, sort: 0 };
      openModal(`<h3>${p.id ? 'Изменить товар' : 'Новый товар'}</h3><form id="prf" style="margin-top:16px"><div class="field"><label>Название</label><input class="inp" name="title" value="${esc(p.title)}" required></div><div class="field"><label>Описание</label><textarea class="inp" name="descr" rows="3" style="min-height:80px">${esc(p.descr)}</textarea></div>
      <div class="row2"><div class="field"><label>Цена, ₽</label><input class="inp mono" type="number" min="0" name="price" value="${p.price}" required></div><div class="field"><label>Категория</label><input class="inp" name="category" value="${esc(p.category)}" required></div></div>
      <div class="row2"><div class="field"><label>Метка (необязательно)</label><input class="inp" name="badge" value="${esc(p.badge)}" placeholder="Хит"></div><div class="field"><label>Порядок</label><input class="inp mono" type="number" name="sort" value="${p.sort}"></div></div>
      <div class="field"><label>Иконка</label><div class="acts" id="icp">${icons.map(i => `<button type="button" class="btn sm ${p.icon === i ? '' : 'dark'}" data-i="${i}">${ic(i, 18)}</button>`).join('')}</div></div>
      <label class="chk" style="margin-bottom:16px"><input type="checkbox" name="active"${p.active ? ' checked' : ''}> Показывать в магазине</label><div class="err" id="prerr"></div><button class="btn" style="width:100%">Сохранить</button></form>`);
      let icon = p.icon;
      $('#icp').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; icon = b.dataset.i; $$('#icp button').forEach(x => x.classList.toggle('dark', x !== b)); };
      $('#prf').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        const row = { title: String(f.get('title')).trim(), descr: String(f.get('descr')).trim(), price: +f.get('price'), category: String(f.get('category')).trim(), badge: String(f.get('badge')).trim(), sort: +f.get('sort') || 0, icon, active: !!f.get('active') };
        const { error } = p.id ? await sb.from('hc_products').update(row).eq('id', p.id) : await sb.from('hc_products').insert(row);
        if (error) { $('#prerr').textContent = errText(error); return; }
        closeModal(); toast('Товар сохранён'); admRender(st);
      };
    };
    $('#pNew').onclick = () => form();
    B.onclick = async e => {
      const ed = e.target.closest('[data-pe]'); if (ed) form((data || []).find(x => x.id === +ed.dataset.pe));
      const dl = e.target.closest('[data-pd]'); if (dl && await confirmBox('Удалить товар? Старые заказы сохранятся.')) { await sb.from('hc_products').delete().eq('id', +dl.dataset.pd); admRender(st); }
    };
  }
  if (admTab === 'forum') {
    const { data } = await sb.from('hc_cats').select('*').order('sort');
    const icons = ['chat', 'megaphone', 'flag', 'shield', 'crown', 'wrench', 'cart', 'coffee', 'users', 'car', 'gun', 'briefcase'];
    B.innerHTML = `<button class="btn" id="cNew" style="margin-bottom:14px">${ic('plus', 18, 2.6)} Новый раздел</button><div class="box" style="padding:10px 16px">${(data || []).map(c => `<div class="thr" style="grid-template-columns:40px 1fr auto;padding:14px 6px"><span class="y">${ic(c.icon, 22)}</span><div><b>${esc(c.title)}${c.staff_only ? ' <span class="pill w">Только администрация</span>' : ''}</b><div class="m">${esc(c.descr)}</div></div><div class="acts"><button class="btn sm dark" data-ce="${c.id}">${ic('pen', 16)}</button><button class="btn sm red" data-cd="${c.id}">${ic('trash', 16)}</button></div></div>`).join('')}</div>`;
    const form = c => {
      c = c || { title: '', descr: '', icon: 'chat', sort: (data || []).length + 1, staff_only: false };
      openModal(`<h3>${c.id ? 'Изменить раздел' : 'Новый раздел'}</h3><form id="cf" style="margin-top:16px"><div class="field"><label>Название</label><input class="inp" name="title" value="${esc(c.title)}" required></div><div class="field"><label>Описание</label><input class="inp" name="descr" value="${esc(c.descr)}"></div><div class="field"><label>Порядок</label><input class="inp mono" type="number" name="sort" value="${c.sort}"></div>
      <div class="field"><label>Иконка</label><div class="acts" id="cip">${icons.map(i => `<button type="button" class="btn sm ${c.icon === i ? '' : 'dark'}" data-i="${i}">${ic(i, 18)}</button>`).join('')}</div></div>
      <label class="chk" style="margin-bottom:16px"><input type="checkbox" name="staff"${c.staff_only ? ' checked' : ''}> Темы создаёт только администрация</label><div class="err" id="cerr"></div><button class="btn" style="width:100%">Сохранить</button></form>`);
      let icon = c.icon;
      $('#cip').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; icon = b.dataset.i; $$('#cip button').forEach(x => x.classList.toggle('dark', x !== b)); };
      $('#cf').onsubmit = async e => {
        e.preventDefault(); const f = new FormData(e.target);
        const row = { title: String(f.get('title')).trim(), descr: String(f.get('descr')).trim(), sort: +f.get('sort') || 0, icon, staff_only: !!f.get('staff') };
        const { error } = c.id ? await sb.from('hc_cats').update(row).eq('id', c.id) : await sb.from('hc_cats').insert(row);
        if (error) { $('#cerr').textContent = errText(error); return; }
        closeModal(); toast('Раздел сохранён'); admRender(st);
      };
    };
    $('#cNew').onclick = () => form();
    B.onclick = async e => {
      const ed = e.target.closest('[data-ce]'); if (ed) form((data || []).find(x => x.id === +ed.dataset.ce));
      const dl = e.target.closest('[data-cd]'); if (dl && await confirmBox('Удалить раздел вместе со всеми темами?')) { await sb.from('hc_cats').delete().eq('id', +dl.dataset.cd); admRender(st); }
    };
  }
  if (admTab === 'settings') {
    const s = S.server || {}, p = S.pay || {};
    const f = (k, l, v, ph = '', t = 'text') => `<div class="field"><label>${l}</label><input class="inp" name="${k}" type="${t}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}"></div>`;
    B.innerHTML = `<form class="box" id="sf"><h3 style="font-size:20px;margin-bottom:16px">Сервер</h3><div class="row2">${f('name', 'Название', s.name)}${f('ip', 'IP:порт', s.ip, '1.2.3.4:7777')}</div>${f('slogan', 'Слоган', s.slogan)}
    <div class="row2">${f('online', 'Онлайн сейчас', s.online, '0', 'number')}${f('max', 'Слотов', s.max, '1000', 'number')}</div>${f('launcher', 'Ссылка на лаунчер', s.launcher, 'https://…')}
    <div class="row2">${f('telegram', 'Telegram', s.telegram, 'https://t.me/…')}${f('vk', 'ВКонтакте', s.vk, 'https://vk.com/…')}</div>${f('discord', 'Discord', s.discord, 'https://discord.gg/…')}
    <div class="field"><label>Правила сервера (пустая строка — новый абзац)</label><textarea class="inp" name="rules" rows="8">${esc(s.rules || '')}</textarea></div>
    <h3 style="font-size:20px;margin:22px 0 16px">Реквизиты для пополнения</h3><div class="row2">${f('card', 'Номер карты / телефон СБП', p.card)}${f('holder', 'Получатель', p.holder, 'Иван И.')}</div>
    <div class="field"><label>Инструкция для игроков</label><textarea class="inp" name="note" rows="3" style="min-height:80px">${esc(p.note || '')}</textarea></div><div class="err" id="serr"></div><button class="btn">Сохранить настройки</button></form>`;
    $('#sf').onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
      const server = { name: d.name, ip: d.ip, slogan: d.slogan, online: +d.online || 0, max: +d.max || 1000, launcher: d.launcher, telegram: d.telegram, vk: d.vk, discord: d.discord, rules: d.rules };
      const pay = { card: d.card, holder: d.holder, note: d.note };
      const { error } = await sb.from('hc_settings').upsert([{ key: 'server', value: server }, { key: 'pay', value: pay }]);
      if (error) { $('#serr').textContent = errText(error); return; }
      S.server = server; S.pay = pay; applySettings(); toast('Настройки сохранены');
    };
  }
}

/* ---------- анимации ---------- */
let io;
function enhance() {
  if (!io) io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.classList.contains('scr')) scramble(e.target); if (e.target.dataset.count != null) countUp(e.target); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.rv:not(.in),.rvc:not(.in),.scr:not([data-s]),[data-count]:not([data-c])').forEach(el => { if (el.classList.contains('scr')) el.dataset.s = 1; if (el.dataset.count != null) el.dataset.c = 1; io.observe(el); });
  $$('.tilt:not([data-t])').forEach(el => {
    el.dataset.t = 1; if (!matchMedia('(hover:hover)').matches) return;
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg) translateY(-4px)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
  $$('.mag:not([data-m])').forEach(el => {
    el.dataset.m = 1; if (!matchMedia('(hover:hover)').matches) return;
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .3}px)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
  const bl = $('#biglogo'); if (bl && !bl.dataset.g) { bl.dataset.g = 1; const g = () => { if (!document.body.contains(bl)) return; bl.classList.remove('glitch'); void bl.offsetWidth; bl.classList.add('glitch'); setTimeout(g, 5000 + Math.random() * 4000); }; setTimeout(g, 6000); bl.addEventListener('pointerenter', () => { bl.classList.remove('glitch'); void bl.offsetWidth; bl.classList.add('glitch'); }); }
}
function scramble(el) {
  const fin = el.textContent, chars = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789#$%&';
  if (fin.length > 60) return;
  let f = 0; const total = 22;
  const kids = el.children.length; if (kids) return; // заголовки с разметкой не трогаем
  const step = () => {
    el.textContent = fin.split('').map((c, i) => c === ' ' ? ' ' : i < fin.length * f / total ? c : chars[Math.floor(Math.random() * chars.length)]).join('');
    if (++f <= total) requestAnimationFrame(() => setTimeout(step, 28)); else el.textContent = fin;
  };
  step();
}
function countUp(el) {
  const to = +el.dataset.count || 0, t0 = performance.now(), d = 1600;
  const step = t => { const p = Math.min(1, (t - t0) / d), v = Math.round(to * (1 - Math.pow(1 - p, 4))); el.textContent = fmtN(v); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// шапка, параллакс
let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY, h = $('#hdr');
  h.classList.toggle('s', y > 20); h.classList.toggle('hide', y > lastY && y > 300 && !$('#nav').classList.contains('open')); lastY = y;
  $$('[data-par]').forEach(el => el.style.transform = `translate(-50%,calc(-50% + ${y * +el.dataset.par}px))`);
}, { passive: true });
$('#burger').onclick = () => $('#nav').classList.toggle('open');
// курсор
(() => {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const c1 = $('#cur'), c2 = $('#cur2'); let x = 0, y = 0, x2 = 0, y2 = 0;
  addEventListener('pointermove', e => { document.body.classList.add('moved'); x = e.clientX; y = e.clientY; c1.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; c2.classList.toggle('big', !!e.target.closest('a,button,.tilt,input,textarea,select')); }, { passive: true });
  const loop = () => { x2 += (x - x2) * .18; y2 += (y - y2) * .18; c2.style.transform = `translate(${x2}px,${y2}px) translate(-50%,-50%)`; requestAnimationFrame(loop); }; loop();
})();
// скрытый вход в панель: 5 нажатий на логотип внизу
(() => { let n = 0, t; $('#flogo').addEventListener('click', () => { n++; clearTimeout(t); t = setTimeout(() => n = 0, 1500); if (n >= 5) { n = 0; location.hash = '#/admin'; } }); })();
$('#year').textContent = new Date().getFullYear();

/* ---------- старт ---------- */
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { me = null; renderHeader(); } });
(async () => {
  await Promise.all([loadSettings().catch(() => { }), loadMe().catch(() => { })]);
  await route();
  setTimeout(() => { $('#pre').classList.add('out'); document.body.classList.add('ready'); }, 700);
  setTimeout(() => $('#pre').remove(), 1800);
})();
