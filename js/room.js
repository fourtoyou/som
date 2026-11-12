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
  var ROWS = 7, STARS = { win: [], garden: [] }, shoot = null, nextShoot = 12, scene = 'house';

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
      rng = 99; STARS.win = [];
      for (k = 0; k < 14; k++) STARS.win.push([11 + Math.floor(rnd() * 37), 11 + Math.floor(rnd() * 30)]);
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

  /* ----- garden props (Buf sprites with their own palettes) ----- */
  // leafy bush: soft, no dark outline (idx 1 deep leaf, 2 mid, 3 light, 4 tip, 5 pink, 6 white, 7 yellow)
  var bushPal = [null, '#4F9262', '#6DB07C', '#8FCB93', '#B6E2A8', '#F7A8B8', '#FFFFFF', '#F5CC48'];
  function bushBuild(w, h, seed, flowers) {
    var b = new Buf(w, h), i, k, x, y;
    rng = seed;
    var n = Math.max(3, Math.round(w / 7));
    for (i = 0; i < n; i++) { // overlapping blobs, taller in the middle
      var cx = 4 + (w - 8) * (i + 0.5) / n, mid = 1 - Math.abs(cx - w / 2) / (w / 2), ry = 3.5 + mid * (h * 0.3) + rnd() * 1.5;
      b.ell(cx, h - ry - 1, 4.5 + rnd() * 2, ry, 2);
    }
    b.rect(2, h - 4, w - 4, 3, 2);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { // light on top edges, deep at the bottom
      if (b.g(x, y) !== 2) continue;
      if (!b.g(x, y - 1) || !b.g(x - 1, y - 1) && (x + y) % 2) b.s(x, y, 3);
      else if (y > h - 4 || (!b.g(x + 1, y) && (x + y) % 2 === 0)) b.s(x, y, 1);
    }
    for (k = 0; k < n * 2; k++) { x = 3 + Math.floor(rnd() * (w - 6)); y = 2 + Math.floor(rnd() * (h - 7)); if (b.g(x, y) === 3) b.s(x, y, 4); if (b.g(x, y) === 2) b.s(x, y, 3); }
    if (flowers) for (k = 0; k < flowers; k++) { x = 3 + Math.floor(rnd() * (w - 6)); y = 3 + Math.floor(rnd() * (h - 9)); if (b.g(x, y)) { b.s(x, y, k % 2 ? 5 : 6); b.s(x + 1, y, k % 2 ? 5 : 6); b.s(x, y + 1, 7); } }
    return bufCanvas(b, bushPal);
  }
  var tuftPal = [null, '#7DBB86', '#5FA06E', '#B6E2A8'];
  function tuftBuild() {
    var b = new Buf(7, 5);
    b.pts(2, [[1, 4], [3, 4], [5, 4]]); b.pts(1, [[1, 3], [3, 3], [5, 3], [3, 2], [3, 1], [1, 2], [5, 2], [0, 1], [6, 1], [3, 0]]); b.pts(3, [[3, 1], [3, 0]]);
    return bufCanvas(b, tuftPal);
  }
  var flPal = [null, '#FFFFFF', '#F5CC48', '#F7A8B8', '#E8708A'];
  function flowerBuild(kind) {
    var b = new Buf(5, 5);
    if (kind === 0) { b.pts(1, [[2, 0], [0, 2], [4, 2], [2, 4], [1, 1], [3, 1], [1, 3], [3, 3]]); b.s(2, 2, 2); b.s(1, 2, 1); b.s(3, 2, 1); b.s(2, 1, 1); b.s(2, 3, 1); }
    else if (kind === 1) { b.pts(3, [[2, 1], [1, 2], [3, 2], [2, 3]]); b.s(2, 2, 2); }
    else { b.pts(4, [[1, 1], [3, 1], [1, 3], [3, 3]]); b.pts(3, [[2, 0], [0, 2], [4, 2], [2, 4]]); b.s(2, 2, 2); }
    return bufCanvas(b, flPal);
  }

  // spirit house: his photo's glossy black pot with white swirl bands, scalloped rim, lobed feet, incense sticks (brown + two red), on a short cream pillar
  var spPal = [null, '#2A2230', '#463E50', '#7A708C', '#F4F0EA', '#CFC8C0', '#E8B04A', '#C98A2B', '#D8324B', '#9A6A4C', '#EADFC9', '#CDBFA6', '#B9B2A8', '#FFE9A8'];
  function spiritBuild() {
    var b = new Buf(30, 54), x, y, i;
    // incense sticks fan out from the rim (4 brown, 2 red) - kept few and light so it stays airy
    [[8, -3], [12, -1.5], [19, 1.5], [23, 3]].forEach(function (s) { for (y = 0; y < 14; y++) b.s(Math.round(s[0] + s[1] * (13 - y) / 7), y + 3, 9); });
    for (y = 0; y < 17; y++) { b.s(Math.round(14.5 + (16 - y) / 12), y, 8); b.s(Math.round(16.5 - (16 - y) / 14), y + 2, 8); }
    // pot body, scalloped rim, lobed feet
    b.ell(15, 26, 13, 8, 2);
    b.rect(3, 17, 25, 3, 2);
    for (x = 3; x <= 27; x++) if (Math.floor((x - 3) / 3) % 2 === 0) b.s(x, 16, 2); // scalloped lip
    b.ell(15, 18, 10, 1.5, 1); // dark mouth
    b.rect(8, 32, 14, 1, 2);
    [[4, 31], [20, 31]].forEach(function (p) { b.ell(p[0] + 3, p[1] + 2, 3.5, 2, 2); });
    for (y = 21; y <= 30; y++) for (x = 2; x <= 28; x++) { // white swirl bands cut into the body (photo: two wavy white stripes)
      if (b.g(x, y) !== 2) continue;
      var w1 = 23 + Math.round(Math.sin(x * 0.55) * 1.2), w2 = 28 + Math.round(Math.sin(x * 0.55 + 2) * 1.0);
      if (y === w1 || y === w1 + 1 || y === w2) b.s(x, y, y === w2 ? 5 : 4);
    }
    b.pts(3, [[5, 22], [6, 21], [7, 20], [4, 25], [5, 26], [6, 17], [7, 17], [18, 17]]); // gloss
    // pillar + gold band + plinth
    b.rect(11, 34, 9, 14, 10); b.rect(17, 34, 3, 14, 11); b.rect(9, 33, 13, 3, 6); b.rect(9, 35, 13, 1, 7); b.rect(11, 40, 9, 1, 6); b.s(12, 33, 13);
    b.rect(7, 48, 17, 4, 12); b.rect(7, 48, 17, 1, 10);
    return bufCanvas(finish(b), spPal);
  }
  // spirit-house colours reused for an ember on the sticks at night
  var SPIRIT = { x: 94, y: 33 }; // top-left of spiritBuild in the scene (base at ~y 87)

  // coiled garden hose (photo: teal-green hose laid in loose loops on concrete) + brass nozzle
  var hosePal = [null, '#1B5753', '#2E9088', '#62C0B2', '#217A74', '#E8B04A', '#B07A22', '#17403D'];
  function hoseBuild() {
    var b = new Buf(56, 30), i, x, y, cx = 33, cy = 14, n = 90, t, rx, ry, px, py;
    var pts = [];
    pts.push([-4, 22], [4, 24], [12, 22]); // tail leaves to the left edge
    for (i = 0; i <= n; i++) {
      t = i / n; var a = Math.PI - t * Math.PI * 3; // 1.5 turns, starts at the left of the coil
      rx = 17 - 10 * t; ry = 10.5 - 6.5 * t;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a) * -1]);
    }
    var tail = [[-4, 21], [3, 24], [9, 23], [pts[3][0], pts[3][1]]];
    b.tx = 4;
    b.thick(tail, 1.5, 2);
    var coil = pts.slice(3);
    b.thick(coil, 1.5, 2);
    var o = new Buf(b.w, b.h);
    for (i = 0; i < b.d.length; i++) o.d[i] = b.d[i];
    for (y = 0; y < b.h; y++) for (x = 0; x < b.w; x++) { // tube shading: light on the upper edge, deep on the lower edge
      if (o.d[y * o.w + x] !== 2) continue;
      var up = y > 0 ? o.d[(y - 1) * o.w + x] : 0, dn = y < o.h - 1 ? o.d[(y + 1) * o.w + x] : 0;
      if (!up) b.d[y * b.w + x] = 3; else if (!dn) b.d[y * b.w + x] = 4;
    }
    // brass nozzle in the middle of the coil
    var ip = coil[coil.length - 1]; b.tx = 0;
    b.rect(Math.round(ip[0]) - 1 + 4, Math.round(ip[1]) - 1, 5, 3, 5); b.rect(Math.round(ip[0]) - 1 + 4, Math.round(ip[1]) + 1, 5, 1, 6); b.s(Math.round(ip[0]) + 5 + 4, Math.round(ip[1]), 6);
    return bufCanvas(finish(b), hosePal);
  }


  var SKY_H = 30, WALL_Y = 27; // garden: sky band 0..30, low wall 27..57, grass from FLOOR_Y
  var gprops = null, gmask = null, gbg = {}, gov = {};
  // sky pixels that a bush or the wall covers: stars must not be drawn there
  function gBlocked(x, y) { return !gmask || x < 0 || y < 0 || x >= W || y >= SKY_H + 4 || gmask[y * W + x] === 1; }
  function gInit() {
    if (gprops) return;
    gprops = { tuft: tuftBuild(), fl: [flowerBuild(0), flowerBuild(1), flowerBuild(2)], spirit: spiritBuild(), hose: hoseBuild(),
      bushL: bushBuild(30, 22, 11, 3), bushM: bushBuild(22, 17, 23, 2), bushS: bushBuild(19, 15, 5, 1), bushXL: bushBuild(38, 26, 41, 4) };
    var m = mk(W, SKY_H + 4), x = m.getContext('2d'), d, i;
    drawBushesTop(x); R(x, '#000', 0, WALL_Y, W, 8);
    d = x.getImageData(0, 0, W, SKY_H + 4).data; gmask = new Uint8Array(W * (SKY_H + 4));
    for (i = 0; i < gmask.length; i++) gmask[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  }
  function drawBushesTop(x) { // bushes peeking above the wall
    x.drawImage(gprops.bushXL, -6, 5); x.drawImage(gprops.bushM, 34, 12); x.drawImage(gprops.bushL, 52, 6); x.drawImage(gprops.bushS, 84, 14); x.drawImage(gprops.bushM, 112, 11);
  }
  /* ----- garden layers ----- */
  var BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function gSkyLayer(c, ph) {
    var p = PH[ph], y, x, t;
    if (ph === 'night') { // Bayer-dithered deep blue, as in the night window
      for (y = 0; y < SKY_H; y++) for (x = 0; x < W; x++) {
        t = y / SKY_H * 1.3 - 0.15 + ((BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 0.5;
        R(c, t > 0.5 ? '#2A2F72' : t > 0.15 ? '#1E2360' : '#141A4A', x, y, 1, 1);
      }
      rng = 99; STARS.garden = [];
      for (var k = 0, tries = 0; k < 16 && tries < 200; tries++) {
        var sx = 4 + Math.floor(rnd() * 120), sy = 2 + Math.floor(rnd() * 22);
        if (!gBlocked(sx, sy)) { STARS.garden.push([sx, sy]); k++; }
      }
    } else {
      for (y = 0; y < SKY_H; y++) R(c, lerpHex(p.skyA, p.skyB, y / SKY_H), 0, y, W, 1);
      var cl = ph === 'evening' ? 'rgba(255,236,200,0.7)' : ph === 'dawn' ? 'rgba(255,240,230,0.7)' : 'rgba(255,255,255,0.8)';
      [[10, 8, 20], [78, 4, 16], [104, 14, 18]].forEach(function (q) { R(c, cl, q[0] + 2, q[1], q[2] - 4, 1); R(c, cl, q[0], q[1] + 1, q[2], 2); R(c, cl, q[0] + 4, q[1] + 3, q[2] - 8, 1); R(c, cl, q[0] + 5, q[1] - 1, 6, 1); });
    }
  }
  function gWallLayer(c) { // low breeze-block wall: cream blocks with soft mint ovals (echo of the wall behind him in the photo)
    var i;
    R(c, '#EFE6D8', 0, WALL_Y, W, FLOOR_Y - WALL_Y - 1);
    R(c, '#FFF7EC', 0, WALL_Y, W, 2); R(c, '#D9CCB8', 0, WALL_Y + 2, W, 1);
    for (i = 0; i < 8; i++) {
      var ox = i * 16 + 3, oy = WALL_Y + 6;
      R(c, '#D7E5E2', ox + 2, oy, 8, 14); R(c, '#D7E5E2', ox, oy + 2, 12, 10);
      R(c, '#BFD3D0', ox + 2, oy + 12, 8, 2); R(c, '#BFD3D0', ox + 1, oy + 11, 10, 1); R(c, '#EAF4F1', ox + 2, oy, 5, 1);
    }
    for (i = 0; i <= 8; i++) { R(c, '#D9CCB8', i * 16 - 1, WALL_Y + 3, 2, FLOOR_Y - WALL_Y - 4); R(c, '#FFF7EC', i * 16 - 2, WALL_Y + 3, 1, FLOOR_Y - WALL_Y - 4); }
    R(c, '#C8B9A2', 0, FLOOR_Y - 3, W, 2); R(c, '#9FB98F', 0, FLOOR_Y - 1, W, 1);
  }
  function gGrassLayer(c) {
    var i, x, y;
    R(c, '#A6D693', 0, FLOOR_Y, W, H - FLOOR_Y);
    rng = 2024; // soft pixel texture: short light / dark dashes
    for (i = 0; i < 520 + (H - 160) * 3; i++) {
      x = Math.floor(rnd() * W); y = FLOOR_Y + 1 + Math.floor(rnd() * (H - FLOOR_Y - 2));
      var r = rnd(); R(c, r < 0.4 ? '#95CA84' : r < 0.8 ? '#B4DEA2' : '#8CC47E', x, y, 1 + Math.floor(rnd() * 3), 1);
    }
    for (y = FLOOR_Y; y < H; y += 4) R(c, 'rgba(255,255,255,0.05)', 0, y, W, 2); // faint mowed bands
    R(c, 'rgba(44,138,134,0.18)', 0, FLOOR_Y, W, 3); // shade under the wall
  }
  function gScatter(c) {
    var i, x, y, D = H - 160;
    rng = 4242;
    for (i = 0; i < 16; i++) { // tufts: along the edges, few in the middle
      x = rnd() < 0.5 ? Math.floor(rnd() * 20) : (rnd() < 0.5 ? 106 + Math.floor(rnd() * 20) : Math.floor(rnd() * 120)); y = FLOOR_Y + 4 + Math.floor(rnd() * (H - FLOOR_Y - 10));
      if (x > 14 && x < 108 && y > 98 && y < 148 + D) { x = x < 60 ? 6 + Math.floor(rnd() * 8) : 110 + Math.floor(rnd() * 12); }
      c.drawImage(gprops.tuft, x, y);
    }
    [[5, 66, 0], [24, 62, 2], [55, 61, 1], [78, 64, 0], [118, 70, 2], [10, 92, 1], [121, 96, 0], [8, 118 + D, 2], [118, 122 + D / 2, 1], [48, 66, 2], [70, 90, 1], [116, 84, 0]]
      .forEach(function (f) { c.drawImage(gprops.fl[f[2]], f[0], f[1]); });
  }

  /* ----- cached backgrounds & overlays ----- */
  var bg = {}, ov = {}, bed, bowls;
  function gardenBgFor(ph) {
    if (gbg[ph]) return gbg[ph];
    gInit();
    var c = mk(W, H), x = c.getContext('2d');
    gSkyLayer(x, ph);
    drawBushesTop(x); gWallLayer(x); gGrassLayer(x); // bushes peek above the wall; then bushes at its foot
    x.drawImage(gprops.bushL, 2, 40); x.drawImage(gprops.bushS, 36, 44); x.drawImage(gprops.bushM, 64, 38); x.drawImage(gprops.bushXL, 88, 29);
    gScatter(x);
    x.drawImage(gprops.spirit, SPIRIT.x, SPIRIT.y); // back-right corner on its pillar
    x.drawImage(gprops.hose, -2, 126 + D); // front-left corner (where the house has the bed)
    if (ph === 'night') { R(x, '#FF7A3A', SPIRIT.x + 13, SPIRIT.y + 1, 1, 1); R(x, '#FFB36B', SPIRIT.x + 16, SPIRIT.y + 3, 1, 1); R(x, '#FF7A3A', SPIRIT.x + 9, SPIRIT.y + 3, 1, 1); R(x, '#FFB36B', SPIRIT.x + 21, SPIRIT.y + 4, 1, 1); } // glowing incense tips
    return (gbg[ph] = c);
  }
  // night: moonlit dim over everything, with a cool dithered pool of light on the lawn; other phases get the same tint as the house
  function gardenOverlayFor(ph) {
    if (gov[ph]) return gov[ph];
    var c = mk(W, H), x = c.getContext('2d');
    if (ph === 'night') {
      var img = x.createImageData(W, H), nc = hex('#1B2560'), mc = hex('#B8C8F0'), px, y, i;
      for (y = 0; y < H; y++) for (px = 0; px < W; px++) {
        var d = Math.sqrt(Math.pow((px - 56) / 60, 2) + Math.pow((y - (118 + D / 2)) / 38, 2)), w = d >= 1 ? 0 : Math.pow(1 - d, 1.3);
        var v2 = w * 2, lo = Math.floor(v2); w = (lo + (v2 - lo > (BAY[(y & 3) * 4 + (px & 3)] + 0.5) / 16 ? 1 : 0)) / 2; // ordered dither between 0 / .5 / 1
        i = (y * W + px) * 4;
        img.data[i] = nc[0] + (mc[0] - nc[0]) * w; img.data[i + 1] = nc[1] + (mc[1] - nc[1]) * w; img.data[i + 2] = nc[2] + (mc[2] - nc[2]) * w;
        img.data[i + 3] = Math.round(255 * (0.5 * (1 - w) + 0.2 * w));
      }
      x.putImageData(img, 0, 0);
    } else PH[ph].tint.forEach(function (t) { x.globalAlpha = t[1]; R(x, t[0], 0, 0, W, H); });
    return (gov[ph] = c);
  }
  function bgFor(ph) {
    if (scene === 'garden') return gardenBgFor(ph);
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
    if (scene === 'garden') return gardenOverlayFor(ph);
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

  var SKY = {
    win: { key: 'win', x: 11, y: 11, w: 37, h: 31, moon: { x: 14, y: 15 }, orange: { x: 37, y: 21 }, hit: { x: 33, y: 16, w: 10, h: 12 } },
    garden: { key: 'garden', x: 4, y: 2, w: 120, h: 24, moon: { x: 99, y: 6, big: 1 }, orange: { x: 88, y: 10 }, hit: { x: 84, y: 5, w: 10, h: 12 } }
  };
  var HOSE_RECT = { x: 0, y: 128, w: 55, h: 27 }, HOSE_SPOT = { x: 72, y: 142 }, GSLEEP = { x: 60, y: 124 }; // y at D = 0

  function init() { if (bed) return; bed = bedBuild(); fanBuild(); bowls = bowlsBuild(); }

  /* ----- public drawing ----- */
  var Room = {
    W: W, H: H, PH: PH, ORDER: ORDER,
    SPOT: { bed: { x: 31, y: 147 }, bowls: { x: 85, y: 146 }, center: { x: 62, y: 128 }, fan: { x: 84, y: 116 }, pot: { x: 104, y: 112 }, hose: { x: HOSE_SPOT.x, y: HOSE_SPOT.y }, gsleep: { x: GSLEEP.x, y: GSLEEP.y } },
    FLOOR: { x0: 12, x1: 112, y0: 98, y1: 148 },
    D: function () { return D; }, VH: function () { return H; },
    // virtual height 160..224: extra rows become floor; bed, bowls and spots stay anchored to the bottom
    setH: function (h) {
      h = Math.max(160, Math.min(224, Math.round(h))); if (h === H && bed) return D;
      H = h; D = h - 160; ROWS = Math.ceil((H - FLOOR_Y) / 16); bg = {}; ov = {}; gbg = {}; gov = {};
      BEDC.y = 135 + D; this.SPOT.bed.y = 147 + D; this.SPOT.bowls.y = 146 + D; this.SPOT.center.y = 128 + Math.round(D / 2);
      this.FLOOR.y1 = 148 + D; this.SPOT.hose.y = HOSE_SPOT.y + D; this.SPOT.gsleep.y = GSLEEP.y + Math.round(D / 2); this.H = H; return D;
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
    // night sky: moon, twinkling stars, shooting star, message stars and the orange star, drawn into `rect` (SKY.win = the window glass, SKY.garden = the sky band)
    drawStars: function (ctx, time, msgs, rect) {
      var j, tw, sx, sy, mo = rect.moon, st = STARS[rect.key], gd = rect.key === 'garden', ox = rect.orange.x, oy = rect.orange.y;
      if (mo.big) { // garden moon
        R(ctx, '#F4EBC8', mo.x + 1, mo.y + 1, 7, 7); R(ctx, '#F4EBC8', mo.x, mo.y + 2, 9, 5); R(ctx, '#F4EBC8', mo.x + 2, mo.y, 5, 9);
        R(ctx, '#D9CFA0', mo.x + 5, mo.y + 4, 3, 3); R(ctx, '#1E2360', mo.x + 5, mo.y, 4, 3); R(ctx, '#1E2360', mo.x + 6, mo.y + 2, 3, 2);
      } else {
        R(ctx, '#F4EBC8', mo.x + 1, mo.y + 1, 5, 5); R(ctx, '#F4EBC8', mo.x, mo.y + 2, 7, 3); R(ctx, '#F4EBC8', mo.x + 2, mo.y, 3, 7);
        R(ctx, '#D9CFA0', mo.x + 4, mo.y + 3, 2, 2); R(ctx, '#1E2360', mo.x + 4, mo.y, 3, 2); R(ctx, '#1E2360', mo.x + 5, mo.y + 2, 2, 1); // crescent bite
      }
      for (j = 0; j < st.length; j++) { // slow twinkle, a few blink out
        tw = (time * 0.5 + j * 0.37) % 4;
        if (j < 5 && tw > 3.3) continue;
        ctx.fillStyle = j < 5 && tw > 2.9 ? '#6F7BB8' : '#DCE6FF'; ctx.fillRect(st[j][0], st[j][1], 1, 1);
        if (gd && j % 4 === 0) { ctx.fillStyle = 'rgba(220,230,255,0.4)'; ctx.fillRect(st[j][0] - 1, st[j][1], 1, 1); ctx.fillRect(st[j][0] + 1, st[j][1], 1, 1); }
      }
      if (!shoot && time > nextShoot) { shoot = { t0: time, x: rect.x + rect.w * (0.55 + Math.random() * 0.4), y: rect.y + 1 + Math.random() * rect.h * 0.3, key: rect.key }; nextShoot = time + 20 + Math.random() * 20; }
      if (shoot && shoot.key !== rect.key) shoot = null; // left the scene it started in
      if (shoot) { // diagonal streak inside the glass / the sky band
        var u = (time - shoot.t0) / 0.9;
        if (u >= 1) shoot = null;
        else for (j = 0; j < 5; j++) {
          sx = Math.round(shoot.x - (u * 18 - j)); sy = Math.round(shoot.y + (u * 9 - j / 2));
          if (sx >= rect.x && sx < rect.x + rect.w && sy >= rect.y && sy < rect.y + rect.h && !(gd && gBlocked(sx, sy))) { ctx.fillStyle = j ? 'rgba(220,230,255,' + (0.7 - j * 0.14) + ')' : '#FFFFFF'; ctx.fillRect(sx, sy, 1, 1); }
        }
      }
      var tw2 = Math.floor(time * 2) % 2, i, n = Math.min(msgs ? msgs.length : 0, 60);
      for (i = 0; i < n; i++) {
        var p = root.SomState.starPos(msgs[i].id), on = (Math.floor(time * 1.3 + i * 0.7) % 3) === 0;
        if (gd) { // window glass x 11..47, y 11..41 -> the sky band; a star on a bush goes to the open sky above it
          var px = rect.x + Math.round((p.x - 11) * (rect.w - 1) / 36), py2 = rect.y + Math.round((p.y - 11) * (rect.h - 1) / 30);
          if (gBlocked(px, py2)) py2 = rect.y + (px * 7 + py2 * 3) % 4;
          p = { x: px, y: py2 };
        }
        ctx.fillStyle = '#FFF0C0'; ctx.fillRect(p.x, p.y, 1, 1);
        if (on) { ctx.fillStyle = 'rgba(255,240,192,0.55)'; ctx.fillRect(p.x - 1, p.y, 1, 1); ctx.fillRect(p.x + 1, p.y, 1, 1); ctx.fillRect(p.x, p.y - 1, 1, 1); ctx.fillRect(p.x, p.y + 1, 1, 1); }
      }
      ctx.fillStyle = '#FFA03A'; ctx.fillRect(ox - 1, oy - 1, 3, 3); ctx.fillRect(ox, oy - 3, 1, 7); ctx.fillRect(ox - 3, oy, 7, 1);
      if (tw2) { ctx.fillStyle = '#FFE0A0'; ctx.fillRect(ox, oy, 1, 1); ctx.fillRect(ox - 2, oy, 1, 1); ctx.fillRect(ox + 2, oy, 1, 1); }
    },
    SKY: SKY, scene: function () { return scene; },
    skyRect: function () { return SKY[scene === 'garden' ? 'garden' : 'win']; },
    setScene: function (s) { scene = s === 'garden' ? 'garden' : 'house'; this.STAR = this.skyRect().hit; },
    // rects (virtual px) where ส้ม must not end up: the garden hose coil
    nogo: function () { return scene === 'garden' ? [{ x: HOSE_RECT.x, y: HOSE_RECT.y + D, w: HOSE_RECT.w, h: HOSE_RECT.h }] : []; },
    STAR: SKY.win.hit,
    shadow: function (ctx, x, y, w) {
      ctx.fillStyle = 'rgba(30,20,60,0.22)';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 1); ctx.fillRect(Math.round(x - w / 2 + 2), Math.round(y), w - 4, 1);
    },
    phaseInfo: function (ph) { return PH[ph]; }
  };
  root.SomRoom = Room;
})(window);
