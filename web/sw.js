/* YOUCHAT — service worker: работа без сети и push-уведомления */
const CACHE='yc-v4';const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin!==location.origin){/* фото из хранилища: сначала кэш — открываются без сети */
  if(/\/storage\/v1\/object\/public\/media\//.test(u.pathname))e.respondWith(caches.open('yc-media').then(async c=>{const hit=await c.match(r);if(hit)return hit;const res=await fetch(r);if(res.ok)c.put(r,res.clone()).catch(()=>{});return res}));
  return}
 if(r.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html'))
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp)).catch(()=>{});return res}).catch(()=>caches.match('./index.html')));
 else e.respondWith(caches.match(r).then(h=>h||fetch(r)))});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data&&e.data.text()}}
 const title=d.title||'YOUCHAT';e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cl=>{
  if(cl.some(c=>c.visibilityState==='visible'&&c.focused))return;/* приложение открыто — уведомление покажет само */
  return self.registration.showNotification(title,{body:d.body||'Новое сообщение',icon:'icon-192.png',badge:'icon-192.png',tag:d.cid||'yc',renotify:true,data:{cid:d.cid||''}})}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const cid=(e.notification.data||{}).cid||'';const url='./'+(cid?'?chat='+encodeURIComponent(cid):'');
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cl=>{for(const c of cl){c.postMessage({type:'open',url:'/?chat='+cid});return c.focus()}return self.clients.openWindow(url)}))});
