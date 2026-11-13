/* sw.js - lets the house open offline. App files are refreshed in the background (stale-while-revalidate);
   photos and fonts are cached as they are viewed. Videos are left to the network (range requests, 100MB+). */
var VER = 'som-v1', SHELL = ['./', 'index.html', 'photos.js', 'videos.js', 'manifest.webmanifest',
  'js/state.js', 'js/sprites.js', 'js/icons.js', 'js/room.js', 'js/fx.js', 'js/audio.js', 'js/cat.js', 'js/ui.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'audio/meow1.mp3', 'audio/meow2.mp3', 'audio/meow3.mp3', 'audio/meow4.mp3'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || r.headers.has('range') || /\.mp4$/.test(u.pathname)) return;
  var ok = u.origin === location.origin || u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith(caches.open(VER).then(function (c) {
    return c.match(r, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(r).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; });
      if (hit) { net.catch(function () {}); return hit; }
      return net.catch(function () { return r.mode === 'navigate' ? c.match('index.html') : Response.error(); });
    });
  }));
});
