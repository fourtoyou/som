/* sprites.js - ส้ม drawn in code. Indexed pixel buffers, integer rasterizer, rim light/shade, auto 1px outline. */
(function (root) {
  'use strict';

  var PAL = [null,
    '#5B3420', '#C9772F', '#E9A35A', '#F6C88A', '#FFF6E8', '#E3D2BE', '#EE9C9C', '#CFE08E', '#2F3A22', '#6B3B2A',
    '#F8DCD2', '#E8BDB4', null, null, null, null, null, null, null,
    '#F2C14E', '#C98F1E', '#FFE69A', '#D8324B', '#2FAE6A', '#3C63C8', '#E03B4F', '#A82237', '#FF8A1F', '#FFC060',
    '#D9444F', '#FFFFFF', '#2FA39E', '#1F7C78', '#1E242B', '#3A4656', '#FFFFFF', '#C9955A', '#A4733F', '#DDB27A', '#EAD0A0'];
  var OUT = 1, STR = 2, FUR = 3, FURL = 4, WHT = 5, WSH = 6, PNK = 7, EYE = 8, PUP = 9, FRK = 10, BEL = 11;

  /* ---------- Buf ---------- */
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  Buf.prototype.g = function (x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; };
  Buf.prototype.s = function (x, y, c, over) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    var i = y * this.w + x;
    if (over && over.indexOf(this.d[i]) < 0) return;
    this.d[i] = c;
  };
  Buf.prototype.ell = function (cx, cy, rx, ry, c, over) {
    var x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) this.s(x, y, c, over);
    }
  };
  Buf.prototype.rect = function (x, y, w, h, c, over) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.s(x + i, y + j, c, over);
  };
  Buf.prototype.poly = function (pts, c, over) {
    var minY = 1e9, maxY = -1e9, n = pts.length, i, y;
    for (i = 0; i < n; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (y = minY; y <= maxY; y++) {
      var xs = [];
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if (a[1] === b[1]) { if (y === a[1]) { xs.push(a[0]); xs.push(b[0]); } continue; }
        var lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        if ((y >= lo && y < hi) || (y === hi && y === maxY)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) for (var x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.s(x, y, c, over);
    }
  };
  Buf.prototype.path = function (pts) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) || 1;
      for (var k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  Buf.prototype.thick = function (pts, r, c, over) {
    var p = this.path(pts);
    for (var i = 0; i < p.length; i++) this.ell(p[i][0], p[i][1], r, r, c, over);
    return p;
  };
  Buf.prototype.stamp = function (rows, x, y, map, over) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
      var v = map ? map[ch] : parseInt(ch, 10);
      if (v) this.s(x + i, y + j, v, over);
    }
  };
  Buf.prototype.blit = function (src, x, y, flipV) {
    for (var j = 0; j < src.h; j++) for (var i = 0; i < src.w; i++) {
      var v = src.d[(flipV ? src.h - 1 - j : j) * src.w + i];
      if (v) this.s(x + i, y + j, v);
    }
  };

  // soft diagonal bands of stripe colour on fur pixels inside a rect
  function bands(b, x0, y0, x1, y1, per, thick, dir) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (b.g(x, y) !== FUR) continue;
      var k = dir > 0 ? x + y : x - y;
      if (((k % per) + per) % per < thick) b.s(x, y, STR);
    }
  }
  // rim light (top-left) / shade (bottom-right) on exterior edges only
  function rim(b) {
    var o = b.d.slice(), w = b.w, h = b.h;
    function og(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : o[y * w + x]; }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = o[y * w + x]; if (c !== FUR && c !== WHT && c !== BEL) continue;
      if (!og(x, y + 1) || !og(x + 1, y)) b.d[y * w + x] = c === FUR ? STR : (c === WHT ? WSH : 12);
      else if (c === FUR && (!og(x - 1, y) || !og(x, y - 1))) b.d[y * w + x] = FURL;
    }
  }
  // 1px outline: every empty pixel 4-adjacent to a filled non-outline pixel. Result is padded by 1 (blit at -1,-1).
  function finish(b) {
    var w = b.w + 2, h = b.h + 2, r = new Buf(w, h), x, y;
    for (y = 0; y < b.h; y++) for (x = 0; x < b.w; x++) r.d[(y + 1) * w + x + 1] = b.d[y * b.w + x];
    var src = r.d.slice();
    function sg(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[y * w + x]; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      var a = sg(x - 1, y), c = sg(x + 1, y), u = sg(x, y - 1), d = sg(x, y + 1);
      if ((a && a !== OUT) || (c && c !== OUT) || (u && u !== OUT) || (d && d !== OUT)) r.d[y * w + x] = OUT;
    }
    return r;
  }
  // full-size finished layer: draw with fn, rim, outline. blit result at (-1,-1)
  function L(W, H, fn) { var b = new Buf(W, H); fn(b); rim(b); return finish(b); }
  function mirrorPts(p, W) { return p.map(function (q) { return [W - q[0], q[1]]; }); }

  function tailDraw(b, pts, r, ring) {
    var p = b.thick(pts, r, FUR);
    if (ring !== false) for (var i = 2; i < p.length - 2; i++) if (Math.floor(i / 3) % 2 === 1) b.ell(p[i][0], p[i][1], r, r, STR, [FUR]);
    return p;
  }

  /* ---------- heads ---------- */
  var EY = {
    half: { y: 7, r: ['11111', '88988', '.898.'] },
    happy: { y: 8, r: ['.111.', '1...1'] },
    sleep: { y: 8, r: ['1...1', '.111.'] },
    blink: { y: 8, r: ['.....', '11111'] },
    open: { y: 6, r: ['.111.', '88988', '88988', '.888.'] }
  };
  EY.meow = EY.half;
  var EYS = {
    half: { y: 7, r: ['1111', '8898'] }, happy: { y: 7, r: ['.11.', '1..1'] }, sleep: { y: 7, r: ['1..1', '.11.'] },
    blink: { y: 7, r: ['....', '1111'] }, open: { y: 6, r: ['.11.', '8998', '8998', '.88.'] }
  };
  EYS.meow = EYS.half;

  var HX = 4, HY = 10, HW = 35, HH = 30; // head composite buffer; head origin inside it. Front head is 27x18.

  // raw (un-outlined) front head, centre column 13
  function headRaw(o) {
    var b = new Buf(27, 18), expr = o.expr || 'half', M = 26;
    var Lr = o.ear ? [[3, 9], [3, 5], [4, 3], [5, 2], [7, 2], [10, 5], [10, 8]] : [[3, 8], [3, 3], [4, 1], [5, 0], [7, 0], [10, 3], [10, 8]];
    b.poly(Lr, FUR); b.poly(mirrorPts(Lr, M), FUR);
    b.ell(13, 9.5, 13, 7, FUR); b.ell(13, 12, 12, 5.5, FUR); // broad skull + full jowls
    var P0 = [[4, 6], [4, 3], [5, 2], [6, 2], [8, 4], [8, 6]], P1 = o.ear ? [[4, 7], [4, 4], [5, 3], [6, 3], [8, 5], [8, 7]] : P0;
    b.poly(P1, PNK, [FUR]); b.poly(mirrorPts(P0, M), PNK, [FUR]);
    b.poly([[12, 4], [14, 4], [15, 7], [17, 10], [9, 10], [11, 7]], WHT, [FUR]);
    b.ell(13, 13, 7, 4, WHT, [FUR]); b.ell(13, 15, 6, 2.5, WHT, [FUR]);
    [[13, 2], [13, 3], [10, 3], [10, 4], [10, 5], [16, 3], [16, 4], [16, 5], [7, 4], [7, 5], [19, 4], [19, 5],
      [1, 10], [2, 10], [3, 10], [1, 12], [2, 12], [23, 10], [24, 10], [25, 10], [24, 12], [25, 12]].forEach(function (p) { b.s(p[0], p[1], STR, [FUR]); });
    var e = EY[expr] || EY.half;
    b.stamp(e.r, 6, e.y); b.stamp(e.r, 16, e.y);
    b.s(12, 11, PNK); b.s(13, 11, PNK); b.s(14, 11, PNK); b.s(13, 12, PNK); b.s(15, 12, FRK); // freckle on viewer's right
    if (expr === 'meow' || o.mo) b.stamp(['111', '171', '.1.'], 12, 13);
    else if (expr === 'happy') {
      [[11, 13], [12, 14], [13, 14], [14, 14], [15, 13]].forEach(function (p) { b.s(p[0], p[1], OUT); });
      [[4, 12], [5, 12], [21, 12], [22, 12]].forEach(function (p) { b.s(p[0], p[1], PNK); });
    } else { b.s(13, 13, OUT); b.s(12, 14, OUT); b.s(14, 14, OUT); }
    return b;
  }
  function headFront(o) {
    var b = headRaw(o); rim(b);
    var out = new Buf(HW, HH); out.blit(finish(b), HX - 1, HY - 1);
    accHead(out, o.acc || {}, 'front');
    return out;
  }
  // head merged into a body buffer with no outline seam; a soft shade under the chin keeps the jaw readable
  function mergeHead(body, o, hox, hoy) {
    var hr = headRaw(o), x, y;
    body.blit(hr, hox, hoy);
    for (y = 0; y < hr.h; y++) for (x = 0; x < hr.w; x++) {
      if (!hr.d[y * hr.w + x]) continue;
      if (hr.g(x, y + 1)) continue;
      var c = body.g(hox + x, hoy + y + 1);
      if (c === FUR || c === FURL) body.s(hox + x, hoy + y + 1, STR); else if (c === WHT) body.s(hox + x, hoy + y + 1, WSH);
    }
  }
  function drawAccFront(out, acc, hox, hoy) {
    var t = new Buf(HW, HH); accHead(t, acc || {}, 'front'); out.blit(t, hox - HX, hoy - HY);
  }

  function headSide(o) {
    var b = new Buf(21, 17), expr = o.expr || 'half';
    b.poly([[12, 6], [13, 1], [14, 0], [15, 0], [18, 5], [18, 7]], FUR);
    b.poly([[2, 7], [3, 1], [4, 0], [5, 0], [10, 4], [10, 7]], FUR);
    b.ell(9, 9.5, 9, 7, FUR);
    b.poly([[4, 6], [4, 3], [5, 2], [6, 3], [8, 5], [8, 6]], PNK, [FUR]);
    b.poly([[14, 5], [14, 2], [15, 2], [16, 5]], PNK, [FUR]);
    b.ell(15, 11.5, 5, 4, WHT, [FUR]); b.ell(12, 14, 5, 2.5, WHT, [FUR]);
    [[6, 3], [6, 4], [8, 3], [8, 4], [8, 5], [10, 4], [10, 5], [2, 10], [3, 10], [4, 10], [2, 12], [3, 12]].forEach(function (p) { b.s(p[0], p[1], STR, [FUR]); });
    rim(b);
    var e = EYS[expr] || EYS.half;
    b.stamp(e.r, 10, e.y);
    b.s(19, 9, PNK); b.s(20, 9, PNK); b.s(20, 10, PNK); b.s(18, 10, FRK);
    if (expr === 'meow' || o.mo) b.stamp(['1111', '1771', '.11.'], 17, 12 - (o.mo === 2 ? 0 : 0));
    else if (expr === 'happy') { b.s(16, 12, OUT); b.s(17, 13, OUT); b.s(18, 13, OUT); b.s(19, 12, OUT); }
    else { b.s(17, 12, OUT); b.s(18, 12, OUT); b.s(19, 12, OUT); }
    var out = new Buf(HW - 6, HH); out.blit(finish(b), HX - 1, HY - 1);
    accHead(out, o.acc || {}, 'side');
    return out;
  }

  /* ---------- accessories ---------- */
  var ACC = {};
  ACC.crown = function () {
    var b = new Buf(15, 10);
    b.poly([[0, 9], [0, 1], [3, 5], [5, 2], [7, 0], [9, 2], [11, 5], [14, 1], [14, 9]], 20);
    b.rect(0, 5, 15, 5, 20); b.rect(0, 9, 15, 1, 21); b.rect(0, 5, 15, 1, 22);
    b.s(0, 1, 22); b.s(7, 0, 22); b.s(14, 1, 22); b.s(5, 2, 22); b.s(9, 2, 22);
    b.rect(6, 6, 3, 3, 24); b.s(6, 6, 22);
    b.rect(2, 6, 2, 2, 23); b.rect(11, 6, 2, 2, 23); b.s(4, 7, 25); b.s(10, 7, 25);
    b.s(1, 8, 21); b.s(13, 8, 21);
    return finish(b);
  };
  function drawSticker(b, x, y) {
    b.ell(x + 2.5, y + 2.5, 2.5, 2.5, 28); b.s(x + 1, y + 1, 29); b.s(x + 2, y + 1, 29);
    [[1, 0], [2, 0], [3, 0], [4, 0], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [0, 2], [0, 3], [0, 4], [5, 1], [5, 2], [5, 3], [5, 4]]
      .forEach(function (p) { b.s(x + p[0], y + p[1], 2); });
  }
  function accHead(out, acc, kind) {
    var front = kind === 'front';
    if (acc.head === 'sticker') drawSticker(out, HX + (front ? 10 : 5), HY + 1);
    if (acc.head === 'crown') out.blit(ACC.crown(), HX + (front ? 13 : 9) - 7 - 1, HY - 5 - 1);
  }

  /* ---------- poses ---------- */
  function res(buf, ax, gy, head, extra) { var r = { buf: buf, ax: ax, ay: gy + 1, head: head }; for (var k in extra) r[k] = extra[k]; return r; }

  function pawLayer(W, H, x, y, rx, ry, c) { return L(W, H, function (b) { b.ell(x, y, rx, ry, c || WHT); b.s(Math.round(x), Math.round(y + ry), WSH); }); }

  function poseSit(o) {
    var W = 62, H = 64, C = 31, G = 58, br = o.br ? 1 : 0, tw = o.tw || 0, paw = o.paw || '';
    var back = new Buf(W, H);
    back.blit(L(W, H, function (b) { tailDraw(b, [[C + 17, G - 4], [C + 22, G - 6], [C + 25, G - 12], [C + 25, G - 19], [C + 23 + tw, G - 24 - (tw ? 1 : 0)]], 2.2); }), -1, -1);
    var body = new Buf(W, H);
    body.ell(C, G - 11, 17, 11, FUR); body.ell(C, G - 21 - br, 13, 10, FUR); // soft pear: round base, rounded torso
    body.rect(C - 10, G - 18, 7, 14, FUR); body.rect(C + 4, G - 18, 7, 14, FUR);
    body.poly([[C - 5, G - 30 - br], [C + 5, G - 30 - br], [C + 6, G - 22], [C + 3, G - 12], [C - 3, G - 12], [C - 6, G - 22]], WHT, [FUR]);
    body.ell(C - 17, G - 1, 3.5, 1.5, WHT, [FUR]); body.ell(C + 17, G - 1, 3.5, 1.5, WHT, [FUR]);
    bands(body, C - 17, G - 14, C - 9, G, 8, 2, 1); bands(body, C + 9, G - 14, C + 17, G, 8, 2, -1);
    [[-11, -26], [-11, -23], [-10, -20], [-9, -17]].forEach(function (p) { body.s(C + p[0], G + p[1], STR, [FUR]); body.s(C + p[0] + 1, G + p[1], STR, [FUR]); body.s(C - p[0], G + p[1], STR, [FUR]); body.s(C - p[0] - 1, G + p[1], STR, [FUR]); });
    var hox = C - 13, hoy = G - 47 - br;
    mergeHead(body, o, hox, hoy);
    rim(body);
    var out = new Buf(W, H); out.blit(back, 0, 0); out.blit(finish(body), -1, -1);
    var raiseL = paw.indexOf('bat') === 0, raiseR = paw.indexOf('groom') === 0;
    if (!raiseL) out.blit(pawLayer(W, H, C - 6.5, G - 3, 3.5, 3), -1, -1);
    if (!raiseR) out.blit(pawLayer(W, H, C + 6.5, G - 3, 3.5, 3), -1, -1);
    drawAccFront(out, o.acc, hox, hoy);
    if (raiseL) { var up = paw === 'bat1' ? 5 : 0; out.blit(L(W, H, function (b) { b.thick([[C - 8, G - 18], [C - 14, G - 22 - up]], 2.4, FUR); b.ell(C - 16, G - 24 - up, 3, 3, WHT); b.s(C - 16, G - 22 - up, WSH); }), -1, -1); }
    if (raiseR) { var g1 = paw === 'groom1' ? 1 : 0; out.blit(L(W, H, function (b) { b.thick([[C + 8, G - 17], [C + 3, G - 26 - g1]], 2.4, FUR); b.ell(C + 2, G - 28 - g1, 3, 3, WHT); b.s(C + 2, G - 26 - g1, WSH); }), -1, -1); }
    return res(out, C, G, { x: hox, y: hoy, w: 27, h: 18 });
  }

  function poseLoaf(o) {
    var W = 62, H = 56, C = 31, G = 50, br = o.br ? 1 : 0, tw = o.tw || 0;
    var body = new Buf(W, H);
    body.ell(C, G - 9, 20, 9, FUR); body.ell(C, G - 13 - br, 16, 9, FUR);
    body.ell(C, G - 13, 6, 6, WHT, [FUR]);
    bands(body, C - 19, G - 16, C - 7, G, 8, 2, 1); bands(body, C + 7, G - 16, C + 19, G, 8, 2, -1);
    var hox = C - 13, hoy = G - 35 - br;
    mergeHead(body, o, hox, hoy);
    rim(body);
    var out = new Buf(W, H); out.blit(finish(body), -1, -1);
    out.blit(L(W, H, function (b) { tailDraw(b, [[C + 15, G - 1], [C + 20, G - 1], [C + 23, G - 5], [C + 22 + tw, G - 9]], 1.9); }), -1, -1);
    out.blit(L(W, H, function (b) { b.ell(C - 5, G - 2, 3.5, 2, WHT); b.ell(C + 5, G - 2, 3.5, 2, WHT); b.s(C - 5, G - 1, WSH); b.s(C + 5, G - 1, WSH); }), -1, -1);
    drawAccFront(out, o.acc, hox, hoy);
    return res(out, C, G, { x: hox, y: hoy, w: 27, h: 18 });
  }

  function poseLie(o) {
    var W = 70, H = 50, X = 8, G = 44, br = o.br ? 0.6 : 0, tw = o.tw || 0, pt = o.pt || 0;
    var back = new Buf(W, H);
    back.blit(L(W, H, function (b) { tailDraw(b, [[X + 3, G - 8], [X - 2, G - 6], [X - 6, G - 2 + (tw ? 1 : 0)], [X - 7 + tw, G + 0]], 2); }), -1, -1);
    var body = new Buf(W, H);
    body.ell(X + 9, G - 9, 8, 8, FUR); body.ell(X + 17, G - 11 - br / 2, 15, 9 + br / 2, FUR);
    body.ell(X + 19, G - 4, 12, 3, WHT, [FUR]); body.ell(X + 27, G - 11, 5, 6, WHT, [FUR]);
    bands(body, X + 1, G - 20, X + 24, G - 4, 6, 2, 1);
    body.ell(X + 5, G - 1, 3.5, 1.5, WHT, [FUR]);
    rim(body);
    var out = new Buf(W, H); out.blit(back, 0, 0); out.blit(finish(body), -1, -1);
    // forelegs stretched forward, white mittens
    out.blit(L(W, H, function (b) { b.thick([[X + 22, G - 11], [X + 42, G - 9 + pt]], 2, FUR); b.ell(X + 44, G - 9 + pt, 3.2, 2.5, WHT); b.s(X + 45, G - 8 + pt, WSH); }), -1, -1);
    out.blit(L(W, H, function (b) { b.thick([[X + 22, G - 6], [X + 40, G - 3]], 2.2, FUR); b.ell(X + 43, G - 3, 3.6, 2.6, WHT); b.s(X + 44, G - 2, WSH); }), -1, -1);
    var hox = X + 24, hoy = G - 29 - Math.round(br);
    out.blit(headFront(o), hox - HX, hoy - HY);
    return res(out, X + 24, G, { x: hox, y: hoy, w: 27, h: 18 });
  }

  function poseBellyUp(o) {
    var W = 56, H = 62, C = 28, br = o.br ? 1 : 0, wg = o.wg || 0, hug = o.hug;
    var G = 52;
    var back = new Buf(W, H);
    back.blit(L(W, H, function (b) { tailDraw(b, [[C - 2, G - 6], [C - 1, G - 1], [C + 2 + wg, G + 3]], 2); }), -1, -1);
    var body = new Buf(W, H);
    body.ell(C, G - 17, 17, 14, FUR);
    body.ell(C, G - 17, 10, 9 + br * 0.5, BEL);
    body.s(C - 1, G - 14, 12); body.s(C + 2, G - 11, 12);
    bands(body, C - 17, G - 24, C - 11, G - 8, 5, 2, 1); bands(body, C + 11, G - 24, C + 17, G - 8, 5, 2, -1);
    rim(body);
    var out = new Buf(W, H); out.blit(back, 0, 0); out.blit(finish(body), -1, -1);
    function leg(ax, ay, bx, by, px, py) { out.blit(L(W, H, function (b) { b.thick([[ax, ay], [bx, by]], 2.6, FUR); b.ell(px, py, 3.4, 3.4, WHT); b.s(px, py + 1, WSH); }), -1, -1); }
    var w1 = wg ? 1 : -1;
    if (hug) {
      leg(C - 13, G - 28, C - 4, G - 22, C - 3, G - 21); leg(C + 13, G - 28, C + 4, G - 22, C + 3, G - 21);
      leg(C - 14, G - 8, C - 6, G - 12, C - 4, G - 13); leg(C + 14, G - 8, C + 6, G - 12, C + 4, G - 13);
    } else {
      leg(C - 13, G - 26, C - 20 - w1, G - 33, C - 21 - w1, G - 36);
      leg(C + 13, G - 26, C + 20 + w1, G - 33, C + 21 + w1, G - 36 + wg);
      leg(C - 14, G - 10, C - 21 + w1, G - 16, C - 22 + w1, G - 19 - wg);
      leg(C + 14, G - 10, C + 21 - w1, G - 16, C + 22 - w1, G - 19);
    }
    var hox = C - 13, hoy = G - 50 - br;
    var hs = headFront({ expr: o.expr, ear: o.ear, mo: o.mo, acc: { head: o.acc && o.acc.head === 'sticker' ? 'sticker' : null } });
    out.blit(hs, hox - HX, hoy - 2, true);
    return res(out, C, G, { x: hox, y: hoy + 1, w: 27, h: 18 }, { belly: { x: C - 11, y: G - 27, w: 22, h: 20 } });
  }

  // side body: walk / eat / crouch / leap / bow
  function poseSide(o) {
    var mode = o.mode || 'walk', f = o.f || 0, W = 74, H = 60, bx = 30, G = 54, tw = o.tw || 0;
    var dy = 0, legs, hox = bx + 13, hoy, tail, rump = o.rump || 0, bodyShape = 'std', head = {};
    var by = G - 17;
    if (mode === 'walk') {
      dy = (f % 2) ? -1 : 0;
      var nf = [3, 0, -3, 0][f], nh = -nf, lift = (f === 1) ? 2 : 0, lift2 = (f === 3) ? 2 : 0;
      legs = { nf: [bx + 10 + nf, G - 3 - lift], ff: [bx + 14 - nf, G - 3 - lift2], nh: [bx - 10 + nh, G - 3 - lift], fh: [bx - 6 - nh, G - 3 - lift2] };
      hoy = by - 10 + dy; tail = [[bx - 14, by - 2 + dy], [bx - 19, by - 8 + dy], [bx - 20, by - 16 + dy], [bx - 17 + tw, by - 22 + dy]];
    } else if (mode === 'eat') {
      dy = 0; legs = { nf: [bx + 13, G - 3], ff: [bx + 9, G - 3], nh: [bx - 12, G - 3], fh: [bx - 6, G - 3] };
      hox = bx + 15; hoy = G - 17 + (o.chew ? 1 : 0);
      tail = [[bx - 14, by - 1], [bx - 19, by - 5], [bx - 22, by - 12], [bx - 21 + tw, by - 17]];
    } else if (mode === 'crouch') {
      dy = 6; legs = { nf: [bx + 14, G - 3], ff: [bx + 10, G - 3], nh: [bx - 10 + rump, G - 3], fh: [bx - 5 + rump, G - 3] };
      hox = bx + 15; hoy = by + dy - 6; tail = [[bx - 14 + rump, by + dy - 1], [bx - 20 + rump, by + dy + 1], [bx - 25 + rump, by + dy - 1 + tw]];
    } else if (mode === 'leap') {
      dy = -3; legs = { nf: [bx + 25, by - 1], ff: [bx + 21, by - 4], nh: [bx - 24, by + 8], fh: [bx - 20, by + 5] };
      hox = bx + 14; hoy = by - 13; tail = [[bx - 14, by - 2 + dy], [bx - 21, by - 3], [bx - 27, by - 1]];
    } else { // bow (stretch)
      bodyShape = 'bow';
      legs = { nf: [bx + 22, G - 3], ff: [bx + 18, G - 3], nh: [bx - 7, G - 3], fh: [bx - 2, G - 3] };
      hox = bx + 13; hoy = G - 18; tail = [[bx - 15, by - 10], [bx - 19, by - 17], [bx - 18 + tw, by - 24]];
    }
    var back = new Buf(W, H);
    back.blit(L(W, H, function (b) { tailDraw(b, tail, 2.1); }), -1, -1);
    function limb(p, hipx, hipy, far) {
      return L(W, H, function (b) { b.thick([[hipx, hipy], [p[0], p[1]]], 2.3, far ? STR : FUR); b.ell(p[0] + 1, Math.min(G - 2, p[1] + 1), 3.4, 2.4, far ? WSH : WHT); });
    }
    var hy = by + 6 + dy;
    var hipsF = bodyShape === 'bow' ? by + 10 : hy;
    back.blit(limb(legs.fh, bx - 4 + (mode === 'crouch' ? rump : 0), hy, true), -1, -1);
    back.blit(limb(legs.ff, bx + 8, hipsF, true), -1, -1);
    var body = new Buf(W, H);
    if (bodyShape === 'bow') {
      body.ell(bx - 5, by - 3, 12, 10, FUR); body.ell(bx + 8, by + 4, 10, 8, FUR);
      body.ell(bx + 2, by + 5, 12, 3, WHT, [FUR]); body.ell(bx + 14, by + 3, 4, 6, WHT, [FUR]);
      bands(body, bx - 16, by - 12, bx + 6, by + 3, 6, 2, 1);
    } else {
      body.ell(bx, by + dy, 16, 10, FUR);
      body.ell(bx + 1, by + 8 + dy, 12, 3, WHT, [FUR]); body.ell(bx + 13, by - 1 + dy, 4, 6, WHT, [FUR]);
      bands(body, bx - 14, by - 10 + dy, bx + 8, by + 5 + dy, 6, 2, 1);
    }
    rim(body);
    var out = new Buf(W, H); out.blit(back, 0, 0); out.blit(finish(body), -1, -1);
    out.blit(limb(legs.nh, bx - 10 + (mode === 'crouch' ? rump : 0), hy, false), -1, -1);
    out.blit(limb(legs.nf, bx + 10, hipsF, false), -1, -1);
    var hd = headSide(o);
    out.blit(hd, hox - HX, hoy - HY);
    return res(out, bx + 3, G, { x: hox, y: hoy, w: 21, h: 17 });
  }

  function poseCurl(o) {
    var W = 64, H = 48, X = 8, G = 40, br = o.br ? 1 : 0, tw = o.tw || 0;
    var body = new Buf(W, H);
    body.ell(X + 25, G - 13, 22, 13 + br * 0.5, FUR);
    bands(body, X + 6, G - 26, X + 46, G - 3, 7, 2, 1);
    body.ell(X + 35, G - 22, 7, 3, FURL, [FUR]);
    rim(body);
    var out = new Buf(W, H); out.blit(finish(body), -1, -1);
    // tail wraps around the front
    out.blit(L(W, H, function (b) { tailDraw(b, [[X + 44, G - 6], [X + 40, G - 1], [X + 30, G + 0], [X + 20, G - 1 + (tw ? 1 : 0)], [X + 15 + tw, G - 4]], 2.3); }), -1, -1);
    // paws tucked under the chin, then head resting on them
    out.blit(L(W, H, function (b) { b.ell(X + 8, G - 4, 4, 3, WHT); b.ell(X + 18, G - 3, 4, 2.6, WHT); b.s(X + 8, G - 2, WSH); b.s(X + 18, G - 1, WSH); }), -1, -1);
    var hox = X, hoy = G - 22 - br;
    out.blit(headFront({ expr: 'sleep', ear: o.ear, acc: o.acc, hideFace: true }), hox - HX, hoy - HY);
    return res(out, X + 24, G, { x: hox, y: hoy, w: 27, h: 18 });
  }

  // cardboard box with ส้ม peeking. vis = how many head rows show above the front panel (0 = empty box)
  function poseBox(o) {
    var W = 48, H = 54, C = 24, P = 30, PB = 46, vis = o.vis || 0;
    var out = new Buf(W, H);
    out.blit(L(W, H, function (b) { b.rect(C - 15, P - 6, 31, 8, 38); b.rect(C - 15, P - 6, 31, 1, 39); }), -1, -1);
    if (vis) {
      var hoy = P - vis;
      out.blit(headFront({ expr: o.expr || 'half', ear: o.ear, acc: o.acc }), C - 13 - HX, hoy - HY);
      if (vis > 16) {
        out.blit(L(W, H, function (b) { b.ell(C - 10, P - 1, 3, 2, WHT); b.ell(C + 10, P - 1, 3, 2, WHT); }), -1, -1);
      }
    }
    out.blit(L(W, H, function (b) {
      b.rect(C - 17, P, 35, PB - P, 37);
      b.rect(C - 17, P, 35, 2, 39); b.rect(C - 17, PB - 3, 35, 3, 38);
      b.rect(C - 3, P + 2, 7, PB - P - 5, 39); b.rect(C - 3, P + 2, 7, 1, 40);
      b.rect(C - 11, P + 7, 3, 1, 38); b.rect(C + 9, P + 7, 3, 1, 38);
    }), -1, -1);
    return res(out, C, PB, { x: C - 13, y: P - vis, w: 27, h: Math.max(1, vis) }, { box: true });
  }

  var BUILD = { sit: poseSit, loaf: poseLoaf, lieSide: poseLie, bellyUp: poseBellyUp, side: poseSide, curl: poseCurl, box: poseBox };

  // pose names used by cat.js map to builders + options
  function specToBuild(s) {
    var o = {}, k;
    for (k in s) o[k] = s[k];
    switch (s.pose) {
      case 'walk': o.mode = 'walk'; return poseSide(o);
      case 'eat': o.mode = 'eat'; return poseSide(o);
      case 'crouch': o.mode = 'crouch'; return poseSide(o);
      case 'leap': o.mode = 'leap'; return poseSide(o);
      case 'stretch': o.mode = 'bow'; return poseSide(o);
      case 'groom': o.paw = 'groom' + (s.f ? 1 : 0); return poseSit(o);
      case 'bat': o.paw = 'bat' + (s.f ? 1 : 0); return poseSit(o);
      case 'inBox': return poseBox(o);
      default: return BUILD[s.pose](o);
    }
  }

  function toCanvas(buf, crop) {
    var minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, x, y;
    for (y = 0; y < buf.h; y++) for (x = 0; x < buf.w; x++) if (buf.d[y * buf.w + x]) {
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    if (maxx < 0) { minx = miny = 0; maxx = maxy = 0; }
    var w = maxx - minx + 1, h = maxy - miny + 1, c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var v = buf.d[(y + miny) * buf.w + x + minx];
      if (!v) continue;
      var hex = PAL[v] || '#ff00ff', i = (y * w + x) * 4;
      img.data[i] = parseInt(hex.substr(1, 2), 16); img.data[i + 1] = parseInt(hex.substr(3, 2), 16); img.data[i + 2] = parseInt(hex.substr(5, 2), 16); img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { cv: c, ox: minx, oy: miny, w: w, h: h };
  }

  var cache = {};
  function accKey(a) { return (a && a.head) || '-'; }
  function get(spec) {
    var key = [spec.pose, spec.f || 0, spec.expr || 'half', spec.br ? 1 : 0, spec.tw || 0, spec.ear ? 1 : 0, spec.mo ? 1 : 0,
      spec.chew ? 1 : 0, spec.rump || 0, spec.wg || 0, spec.hug ? 1 : 0, spec.pt || 0, spec.vis || 0, accKey(spec.acc)].join('|');
    var hit = cache[key];
    if (hit) return hit;
    var r = specToBuild(spec), c = toCanvas(r.buf);
    var m = {
      cv: c.cv, w: c.w, h: c.h, ax: r.ax - c.ox, ay: r.ay - c.oy,
      head: { x: r.head.x - c.ox, y: r.head.y - c.oy, w: r.head.w, h: r.head.h },
      belly: r.belly ? { x: r.belly.x - c.ox, y: r.belly.y - c.oy, w: r.belly.w, h: r.belly.h } : null
    };
    cache[key] = m;
    return m;
  }

  // standalone accessory canvas for UI icons
  function accIcon(id) {
    var buf = ACC[id] ? ACC[id]() : null;
    if (id === 'sticker') { buf = new Buf(10, 10); buf.ell(4.5, 4.5, 4, 4, 28); buf.s(2, 2, 29); buf.s(3, 2, 29); buf.s(2, 3, 29); buf = finish(buf); }
    return buf ? toCanvas(buf).cv : null;
  }

  root.SomSprites = { Buf: Buf, PAL: PAL, build: specToBuild, get: get, accIcon: accIcon, ACC: ACC, toCanvas: toCanvas, finish: finish };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SomSprites;
})(typeof window !== 'undefined' ? window : this);
