/* room.js - the family's home in 128x160 virtual pixels. Static layers cached per lighting phase. */
(function (root) {
  'use strict';
  var SP = root.SomSprites, Buf = SP.Buf, finish = SP.finish, IC = root.SomIcons;
  var W = 128, H = 160, FLOOR_Y = 58, D = 0; // H = virtual height (160..224), D = extra floor rows

  var PH = {
    dawn:    { skyA: '#F4A9A8', skyB: '#FFD8A6', line: '#C98F9A', glint: '#FFE9D2', fan: false, beam: 0.35, tint: [['#FFB6A0', 0.10], ['#4A4F8A', 0.06]] },
    morning: { skyA: '#BFE3EE', skyB: '#EAF7F2', line: '#8DB8C2', glint: '#F4FCFF', fan: false, beam: 1, tint: [['#FFF2C8', 0.05]] },
    day:     { skyA: '#A9DDEE', skyB: '#DDF2F6', line: '#8DB8C2', glint: '#F4FCFF', fan: true, beam: 0, tint: [] },
    evening: { skyA: '#FF9A55', skyB: '#FFC878', line: '#C9743F', glint: '#FFE0A8', fan: true, beam: 0, tint: [['#FF8F3F', 0.22]] },
    night:   { skyA: '#10173F', skyB: '#26306E', line: '#3A4580', glint: '#33407F', fan: false, beam: 0, tint: [] }
  };
  var ORDER = ['dawn', 'morning', 'day', 'evening', 'night'];
  var LAMP = { x: 66, y: 22 }, BEDC = { x: 31, y: 135 };
  var ROWS = 7, NSTARS = [], shoot = null, nextShoot = 12;

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function lerpHex(a, b, t) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function bufCanvas(buf, pal) { return IC.raw(buf, pal); }

  var rng = 12345;
  function rnd() { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }

  /* ----- static pieces ----- */
  function rosette() {
    var b = new Buf(11, 11), pal = [null, '#5DA06C', '#3F7E50', '#7DBB86'];
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
      for (var k = 2; k <= 5; k++) {
        var w = k < 4 ? 1 : 0;
        for (var j = -w; j <= w; j++) { b.s(5 + d[0] * k + (d[1] ? j : 0), 5 + d[1] * k + (d[0] ? j : 0), 1); }
      }
      b.s(5 + d[0] * 3, 5 + d[1] * 3, 2);
    });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) { b.s(5 + d[0] * 2, 5 + d[1] * 2, 3); b.s(5 + d[0] * 3, 5 + d[1] * 3, 1); });
    b.s(5, 5, 2); b.s(4, 5, 2); b.s(6, 5, 2); b.s(5, 4, 2); b.s(5, 6, 2);
    return bufCanvas(b, pal);
  }

  function floorLayer(c) {
    var ros = rosette(), x, y, i, j;
    R(c, '#E3F0E8', 0, FLOOR_Y, W, H - FLOOR_Y);
    rng = 777;
    for (j = 0; j < ROWS; j++) for (i = 0; i < 8; i++) {
      var tx = i * 16, ty = FLOOR_Y + j * 16;
      for (var k = 0; k < 9; k++) {
        var fx = tx + 2 + Math.floor(rnd() * 12), fy = ty + 2 + Math.floor(rnd() * 12), fl = 1 + Math.floor(rnd() * 3);
        R(c, rnd() < 0.5 ? '#CFE3D7' : '#D8EADF', fx, fy, fl, 1);
        if (rnd() < 0.4) R(c, '#CFE3D7', fx + 1, fy + 1, 1, 1);
      }
    }
    for (x = 0; x <= W; x += 16) R(c, '#B3CDC0', x, FLOOR_Y, 1, H - FLOOR_Y);
    for (y = FLOOR_Y; y < H; y += 16) R(c, '#B3CDC0', 0, y, W, 1);
    for (j = 0; j < ROWS; j++) for (i = 0; i <= 8; i++) c.drawImage(ros, i * 16 - 5, FLOOR_Y + j * 16 - 5);
    // soft shade under the baseboard
    R(c, 'rgba(44,138,134,0.25)', 0, FLOOR_Y, W, 2);
  }

  function windowLayer(c, ph, night) {
    var p = PH[ph], y, k;
    R(c, '#F2F6F4', 8, 8, 43, 37);
    if (night) { // Bayer-dithered deep blue-purple sky + ; moon + stars are drawn live above the dimming (twinkle)
      var B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], x, t, u;
      for (y = 10; y < 43; y++) for (x = 10; x < 49; x++) {
        t = (y - 10) / 32 * 1.3 - 0.15 + ((B[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 0.5;
        R(c, t > 0.5 ? '#2A2F72' : t > 0.15 ? '#1E2360' : '#141A4A', x, y, 1, 1);
      }
      rng = 99; NSTARS = [];
      for (k = 0; k < 14; k++) NSTARS.push([11 + Math.floor(rnd() * 37), 11 + Math.floor(rnd() * 30)]);
    } else for (y = 10; y < 43; y++) R(c, lerpHex(p.skyA, p.skyB, (y - 10) / 32), 10, y, 39, 1);
    for (k = 0; k < 6; k++) { R(c, p.line, 10, 14 + k * 5, 39, 1); R(c, p.glint, 10, 10 + k * 5, 39, 1); }
    R(c, '#CBD6D2', 8, 8, 43, 1); R(c, '#CBD6D2', 8, 8, 2, 37); R(c, '#D9E2DE', 49, 8, 2, 37);
    R(c, '#E4ECE9', 6, 44, 47, 2); R(c, '#BFD0CB', 6, 46, 47, 1);
  }

  var bedPal = [null, '#5B3420', '#273F63', '#3A5A8C', '#9C9C9C', '#838383', '#B5B5B5', '#FFFFFF'];
  function bedBuild() {
    var back = new Buf(68, 50), front = new Buf(68, 50), cx = 34, cy = 25, x, y;
    back.ell(cx, cy, 33, 22, 2); back.ell(cx, cy - 1, 32, 21, 3, [2]);
    back.ell(cx, cy, 32, 21, 2);
    back.ell(cx, cy, 27, 16, 5); back.ell(cx - 1, cy - 1, 25.5, 15, 4); back.ell(cx - 6, cy - 6, 9, 3.5, 6, [4]);
    // front rim = lower half of the ring band
    for (y = cy + 4; y < 50; y++) for (x = 0; x < 68; x++) {
      var o = Math.pow((x - cx) / 33.5, 2) + Math.pow((y - cy) / 22.5, 2), i = Math.pow((x - cx) / 27.5, 2) + Math.pow((y - cy) / 16.5, 2);
      if (o <= 1 && i > 1) front.s(x, y, y > cy + 17 ? 2 : (y < cy + 9 ? 3 : 2));
    }
    function dot(b, x, y) { b.s(x, y, 7); b.s(x + 2, y, 7); b.rect(x, y + 1, 3, 1, 7); }
    [[9, 12], [19, 5], [42, 4], [53, 8], [61, 16]].forEach(function (p) { dot(back, p[0], p[1]); });
    [[7, 36], [17, 44], [46, 44], [57, 37]].forEach(function (p) { dot(front, p[0], p[1]); });
    return { back: bufCanvas(finish(back), bedPal), front: bufCanvas(finish(front), bedPal) };
  }

  var fanPal = [null, '#1D8799', '#2BB3C9', '#7ADBE8', '#6E8C96', '#B9C9CE', '#5B3420', '#DDE8EA'];
  var fanStand, fanHeads = [];
  function fanBuild() {
    var s = new Buf(29, 78);
    s.rect(13, 28, 3, 44, 5); s.rect(15, 28, 1, 44, 4); s.rect(11, 24, 7, 5, 4);
    s.ell(14.5, 73, 11, 3, 4); s.ell(14.5, 72, 8, 1.5, 5);
    fanStand = bufCanvas(finish(s), fanPal);
    for (var f = 0; f < 3; f++) {
      var b = new Buf(29, 29), cx = 14, cy = 14, a0 = f * 0.7, i, a;
      b.ell(cx, cy, 13, 13, 7);
      for (i = 0; i < 3; i++) {
        a = a0 + i * 2.094;
        var p1 = [cx + Math.cos(a - 0.5) * 11, cy + Math.sin(a - 0.5) * 11], p2 = [cx + Math.cos(a + 0.5) * 11, cy + Math.sin(a + 0.5) * 11], pm = [cx + Math.cos(a) * 11, cy + Math.sin(a) * 11];
        b.poly([[cx, cy], [Math.round(p1[0]), Math.round(p1[1])], [Math.round(pm[0]), Math.round(pm[1])], [Math.round(p2[0]), Math.round(p2[1])]], 2);
        b.thick([[cx, cy], [Math.round(pm[0]), Math.round(pm[1])]], 0.5, 3);
      }
      for (i = 0; i < 360; i += 3) { var r = i * Math.PI / 180; b.s(cx + Math.cos(r) * 12.6, cy + Math.sin(r) * 12.6, 1); b.s(cx + Math.cos(r) * 13.4, cy + Math.sin(r) * 13.4, 1); }
      for (i = 0; i < 360; i += 3) { r = i * Math.PI / 180; b.s(cx + Math.cos(r) * 7, cy + Math.sin(r) * 7, 1, [2, 7]); }
      for (i = 0; i < 4; i++) { a = i * Math.PI / 4; b.thick([[cx + Math.cos(a) * 3, cy + Math.sin(a) * 3], [cx + Math.cos(a) * 12, cy + Math.sin(a) * 12]], 0.4, 1); b.thick([[cx - Math.cos(a) * 3, cy - Math.sin(a) * 3], [cx - Math.cos(a) * 12, cy - Math.sin(a) * 12]], 0.4, 1); }
      b.ell(cx, cy, 2, 2, 1); b.s(cx - 1, cy - 1, 3);
      fanHeads.push(bufCanvas(b, fanPal));
    }
  }

  var bowlPal = [null, '#5B3420', '#CFE9F2', '#9ED3E6', '#EAF8FC', '#E8B04A', '#C98A2B', '#8B5A2B', '#FFD27A'];
  function bowlsBuild() {
    var w = new Buf(15, 12), f = new Buf(15, 12);
    w.ell(7, 8, 7, 3.5, 2); w.ell(7, 6, 7, 3, 4); w.ell(7, 6, 5.5, 2, 3); w.rect(2, 4, 2, 1, 4);
    f.ell(7, 8, 7, 3.5, 6); f.ell(7, 6, 7, 3, 5); f.ell(7, 6, 5.5, 2, 6); f.ell(7, 5.5, 5, 1.5, 7);
    [[4, 5], [6, 4], [8, 5], [10, 5], [7, 6], [5, 6]].forEach(function (p) { f.s(p[0], p[1], 8); });
    return { water: bufCanvas(finish(w), bowlPal), food: bufCanvas(finish(f), bowlPal) };
  }

  /* ----- cached backgrounds & overlays ----- */
  var bg = {}, ov = {}, bed, bowls;
  function bgFor(ph) {
    if (bg[ph]) return bg[ph];
    var c = mk(W, H), x = c.getContext('2d'), night = ph === 'night', i;
    R(x, '#49B9B2', 0, 0, W, 55);
    for (i = 0; i < W; i += 8) { R(x, '#3A9F99', i, 0, 1, 55); }
    for (i = 4; i < W; i += 16) { R(x, 'rgba(108,207,198,0.45)', i, 0, 2, 55); }
    R(x, '#3A9F99', 0, 55, W, 1); R(x, '#2C8A86', 0, 56, W, 2);
    floorLayer(x); windowLayer(x, ph, night);
    if (night) { // wall lamp
      R(x, '#8B6B4A', 64, 9, 4, 5);
      x.fillStyle = '#FFD27A'; [[62, 14, 8], [61, 15, 10], [60, 16, 12], [60, 17, 12], [59, 18, 14], [59, 19, 14]].forEach(function (r) { x.fillRect(r[0], r[1], r[2], 1); });
      R(x, '#FFF0B8', 63, 15, 4, 3); R(x, '#C98F1E', 59, 20, 14, 1);
    }
    return (bg[ph] = c);
  }
  function overlayFor(ph) {
    if (ov[ph]) return ov[ph];
    var c = mk(W, H), x = c.getContext('2d');
    if (ph === 'night') {
      var img = x.createImageData(W, H), nc = hex('#1B2560'), wc = hex('#FFC970');
      for (var y = 0; y < H; y++) for (var px = 0; px < W; px++) {
        var d1 = Math.sqrt(Math.pow((px - LAMP.x) / 52, 2) + Math.pow((py(y) - LAMP.y) / 44, 2));
        var d2 = Math.sqrt(Math.pow((px - BEDC.x) / 30, 2) + Math.pow((y - BEDC.y) / 20, 2));
        var d = Math.min(d1, d2 * 1.15), w = d < 0.3 ? 1 : d < 0.55 ? 0.75 : d < 0.8 ? 0.45 : d < 1 ? 0.2 : 0;
        var i = (y * W + px) * 4;
        img.data[i] = nc[0] + (wc[0] - nc[0]) * w; img.data[i + 1] = nc[1] + (wc[1] - nc[1]) * w; img.data[i + 2] = nc[2] + (wc[2] - nc[2]) * w;
        img.data[i + 3] = Math.round(255 * (0.56 * (1 - w) + 0.13 * w));
      }
      x.putImageData(img, 0, 0);
    } else PH[ph].tint.forEach(function (t) { x.globalAlpha = t[1]; R(x, t[0], 0, 0, W, H); });
    return (ov[ph] = c);
  }
  function py(y) { return y; }

  function init() { if (bed) return; bed = bedBuild(); fanBuild(); bowls = bowlsBuild(); }

  /* ----- public drawing ----- */
  var Room = {
    W: W, H: H, PH: PH, ORDER: ORDER,
    SPOT: { bed: { x: 31, y: 147 }, bowls: { x: 85, y: 146 }, center: { x: 62, y: 128 }, fan: { x: 84, y: 116 } },
    FLOOR: { x0: 12, x1: 112, y0: 98, y1: 148 },
    D: function () { return D; }, VH: function () { return H; },
    // virtual height 160..224: extra rows become floor; bed, bowls and spots stay anchored to the bottom
    setH: function (h) {
      h = Math.max(160, Math.min(224, Math.round(h))); if (h === H && bed) return D;
      H = h; D = h - 160; ROWS = Math.ceil((H - FLOOR_Y) / 16); bg = {}; ov = {};
      BEDC.y = 135 + D; this.SPOT.bed.y = 147 + D; this.SPOT.bowls.y = 146 + D; this.SPOT.center.y = 128 + Math.round(D / 2);
      this.FLOOR.y1 = 148 + D; this.H = H; return D;
    },
    beamSpot: function (hour) { return { x: 40 + Math.max(0, Math.min(4, hour - 7)) * 2, y: 108 }; },
    drawBg: function (ctx, ph, prev, t) { // t: 0..1 progress of cross-fade from prev
      init();
      if (prev && t < 1) { ctx.drawImage(bgFor(prev), 0, 0); ctx.globalAlpha = t; ctx.drawImage(bgFor(ph), 0, 0); ctx.globalAlpha = 1; }
      else ctx.drawImage(bgFor(ph), 0, 0);
    },
    drawBeam: function (ctx, hour, strength) {
      if (strength <= 0.01) return;
      var sh = (Math.max(7, Math.min(11, hour)) - 7) * 2.5, i;
      ctx.save(); ctx.fillStyle = '#FFE6A0';
      for (var y = 66; y < 132; y++) {
        var u = (y - 66) / 66, x0 = Math.round(14 + u * 18 + sh), x1 = Math.round(46 + u * 26 + sh);
        // louver shadow bars
        var bar = ((y - 66) % 10) < 2;
        ctx.globalAlpha = (bar ? 0.12 : 0.34) * strength; ctx.fillRect(x0, y, x1 - x0, 1);
        ctx.globalAlpha = (bar ? 0.04 : 0.12) * strength; ctx.fillRect(x0 - 1, y, 1, 1); ctx.fillRect(x1, y, 1, 1);
      }
      ctx.restore();
    },
    drawFan: function (ctx, on, time) {
      init(); ctx.drawImage(fanStand, 97, 30); ctx.drawImage(fanHeads[on ? Math.floor(time * 14) % 3 : 0], 97, 30);
    },
    drawBowls: function (ctx, food) {
      init(); ctx.drawImage(bowls.water, 91, 135 + D); ctx.drawImage(bowls.food, 107, 135 + D);
      if (food) { var c = IC.canvas(food); ctx.drawImage(c, 114 - Math.floor(c.width / 2), 136 + D - Math.floor(c.height / 2)); }
    },
    drawBed: function (ctx) { init(); ctx.drawImage(bed.back, -3, 110 + D); },
    drawBedFront: function (ctx) { init(); ctx.drawImage(bed.front, -3, 110 + D); },
    drawOverlay: function (ctx, ph, prev, t) {
      if (prev && t < 1) { ctx.drawImage(overlayFor(prev), 0, 0); ctx.globalAlpha = t; ctx.drawImage(overlayFor(ph), 0, 0); ctx.globalAlpha = 1; }
      else ctx.drawImage(overlayFor(ph), 0, 0);
    },
    drawStars: function (ctx, time, msgs) { // message stars + the orange star (night)
      var j, tw, sx, sy;
      R(ctx, '#F4EBC8', 15, 16, 5, 5); R(ctx, '#F4EBC8', 14, 17, 7, 3); R(ctx, '#F4EBC8', 16, 15, 3, 7);
      R(ctx, '#D9CFA0', 18, 18, 2, 2); R(ctx, '#1E2360', 18, 15, 3, 2); R(ctx, '#1E2360', 19, 17, 2, 1); // crescent bite
      for (j = 0; j < NSTARS.length; j++) { // slow twinkle, a few blink out
        tw = (time * 0.5 + j * 0.37) % 4;
        if (j < 5 && tw > 3.3) continue;
        ctx.fillStyle = j < 5 && tw > 2.9 ? '#6F7BB8' : '#DCE6FF'; ctx.fillRect(NSTARS[j][0], NSTARS[j][1], 1, 1);
      }
      if (!shoot && time > nextShoot) { shoot = { t0: time, x: 40 + Math.random() * 6, y: 12 + Math.random() * 8 }; nextShoot = time + 20 + Math.random() * 20; }
      if (shoot) { // diagonal streak inside the window glass
        var u = (time - shoot.t0) / 0.9;
        if (u >= 1) shoot = null;
        else for (j = 0; j < 5; j++) {
          sx = Math.round(shoot.x - (u * 18 - j)); sy = Math.round(shoot.y + (u * 9 - j / 2));
          if (sx > 10 && sx < 48 && sy > 10 && sy < 42) { ctx.fillStyle = j ? 'rgba(220,230,255,' + (0.7 - j * 0.14) + ')' : '#FFFFFF'; ctx.fillRect(sx, sy, 1, 1); }
        }
      }
      var tw = Math.floor(time * 2) % 2, i, n = Math.min(msgs ? msgs.length : 0, 60);
      for (i = 0; i < n; i++) {
        var p = root.SomState.starPos(msgs[i].id), on = (Math.floor(time * 1.3 + i * 0.7) % 3) === 0;
        ctx.fillStyle = '#FFF0C0'; ctx.fillRect(p.x, p.y, 1, 1);
        if (on) { ctx.fillStyle = 'rgba(255,240,192,0.55)'; ctx.fillRect(p.x - 1, p.y, 1, 1); ctx.fillRect(p.x + 1, p.y, 1, 1); ctx.fillRect(p.x, p.y - 1, 1, 1); ctx.fillRect(p.x, p.y + 1, 1, 1); }
      }
      ctx.fillStyle = '#FFA03A'; ctx.fillRect(36, 20, 3, 3); ctx.fillRect(37, 18, 1, 7); ctx.fillRect(34, 21, 7, 1);
      if (tw) { ctx.fillStyle = '#FFE0A0'; ctx.fillRect(37, 21, 1, 1); ctx.fillRect(35, 21, 1, 1); ctx.fillRect(39, 21, 1, 1); }
    },
    STAR: { x: 33, y: 16, w: 10, h: 12 },
    shadow: function (ctx, x, y, w) {
      ctx.fillStyle = 'rgba(30,20,60,0.22)';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 1); ctx.fillRect(Math.round(x - w / 2 + 2), Math.round(y), w - 4, 1);
    },
    phaseInfo: function (ph) { return PH[ph]; }
  };
  root.SomRoom = Room;
})(window);
