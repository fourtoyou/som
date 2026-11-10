/* fx.js - small pixel particles in virtual coordinates: hearts, crumbs, confetti-free sparkles, Zzz. */
(function (root) {
  'use strict';
  var IC = root.SomIcons, list = [], reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var ZG = ['11111', '...1.', '..1..', '.1...', '11111'];

  function add(p) { if (list.length < (reduced ? 18 : 60)) list.push(p); }
  var Fx = {
    hearts: function (x, y, n) {
      n = n || 1;
      for (var i = 0; i < n; i++) add({ k: 'heart', x: x + (Math.random() * 6 - 3), y: y, vx: Math.random() * 8 - 4, vy: -(16 + Math.random() * 8), t: 0, life: 1.3, ph: Math.random() * 6 });
    },
    crumbs: function (x, y) {
      for (var i = 0; i < (reduced ? 3 : 7); i++) add({ k: 'crumb', x: x, y: y, vx: Math.random() * 30 - 15, vy: -(10 + Math.random() * 18), t: 0, life: 0.7, c: i % 2 ? '#C98A4B' : '#F6C88A' });
    },
    zzz: function (x, y) { add({ k: 'z', x: x, y: y, vx: 4, vy: -7, t: 0, life: 2.6, s: 0 }); },
    sparkle: function (x, y) {
      for (var i = 0; i < (reduced ? 3 : 8); i++) add({ k: 'spark', x: x + Math.random() * 20 - 10, y: y + Math.random() * 12 - 6, vx: 0, vy: -5, t: 0, life: 0.9 });
    },
    update: function (dt) {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i]; p.t += dt;
        if (p.t >= p.life) { list.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'crumb') p.vy += 60 * dt;
        if (p.k === 'heart') p.vx = Math.sin(p.t * 5 + p.ph) * 6;
      }
    },
    draw: function (ctx) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i], a = Math.min(1, (p.life - p.t) / 0.4);
        ctx.globalAlpha = a;
        if (p.k === 'heart') { var h = IC.canvas('heart'); ctx.drawImage(h, Math.round(p.x - 4), Math.round(p.y - 4)); }
        else if (p.k === 'crumb') { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
        else if (p.k === 'spark') { ctx.fillStyle = '#FFE6A0'; var sx = Math.round(p.x), sy = Math.round(p.y); ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1); }
        else if (p.k === 'z') {
          var sz = p.t < 0.9 ? 1 : 2, px = Math.round(p.x), py = Math.round(p.y);
          for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) if (ZG[r][c] === '1') {
            ctx.fillStyle = '#3B2417'; ctx.fillRect(px + c * sz + 1, py + r * sz + 1, sz, sz);
            ctx.fillStyle = '#FFF8EE'; ctx.fillRect(px + c * sz, py + r * sz, sz, sz);
          }
        }
      }
      ctx.globalAlpha = 1;
    },
    clear: function () { list.length = 0; }, reduced: function () { return reduced; }
  };
  root.SomFx = Fx;
})(window);
