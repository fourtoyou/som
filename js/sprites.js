/* sprites.js - ส้ม drawn in code, chibi look ported from dev/concept/cute.py. Indexed pixel buffers, 1px auto outline. */
(function (root) {
  'use strict';

  var PAL = [null,
    '#603824', '#D47C38', '#F0A358', '#FACC92', '#FFF9EE', '#ECDCC8', '#F4969E', '#ACD470', '#302822', '#7A4A34',
    '#FFF1E6', '#F0D6C8', '#FAACA4', '#FFFFFF', null, null, null, null, null,
    '#F2C14E', '#C98F1E', '#FFE69A', '#D8324B', '#2FAE6A', '#3C63C8', '#E03B4F', '#A82237', '#FF8A1F', '#FFC060',
    '#D9444F', '#FFFFFF', '#2FA39E', '#1F7C78', '#1E242B', '#3A4656', '#FFFFFF', '#C9955A', '#A4733F', '#DDB27A', '#EAD0A0'];
  var OUT = 1, STR = 2, FUR = 3, FURL = 4, WHT = 5, WSH = 6, PNK = 7, GRN = 8, EYE = 9, FRK = 10, BEL = 11, BEL2 = 12, BLU = 13, HI = 14;

  /* ---------- Buf (tx/ty = drawing origin shift; blit/finish ignore it) ---------- */
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.tx = 0; this.ty = 0; }
  Buf.prototype.g = function (x, y) {
    x = Math.round(x) + this.tx; y = Math.round(y) + this.ty;
    return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x];
  };
  Buf.prototype.s = function (x, y, c, over) {
    x = Math.round(x) + this.tx; y = Math.round(y) + this.ty;
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
  // raw copy of a finished layer (no origin shift), optional vertical flip
  Buf.prototype.blit = function (src, x, y, flipV) {
    for (var j = 0; j < src.h; j++) for (var i = 0; i < src.w; i++) {
      var v = src.d[(flipV ? src.h - 1 - j : j) * src.w + i];
      if (!v) continue;
      var X = x + i, Y = y + j;
      if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = v;
    }
  };
  // super-ellipse with pixel-centre test: same maths as concept/cute.py ell()
  Buf.prototype.sq = function (cx, cy, rx, ry, c, p, over) {
    p = p || 2;
    var x0 = Math.floor(cx - rx) - 1, x1 = Math.ceil(cx + rx) + 1, y0 = Math.floor(cy - ry) - 1, y1 = Math.ceil(cy + ry) + 1;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (Math.pow(Math.abs((x + 0.5 - cx) / rx), p) + Math.pow(Math.abs((y + 0.5 - cy) / ry), p) <= 1) this.s(x, y, c, over);
    }
  };
  Buf.prototype.tri = function (pts, c, over) {
    var x1 = pts[0][0], y1 = pts[0][1], x2 = pts[1][0], y2 = pts[1][1], x3 = pts[2][0], y3 = pts[2][1];
    function sg(px, py, ax, ay, bx, by) { return (px - bx) * (ay - by) - (ax - bx) * (py - by); }
    var X0 = Math.floor(Math.min(x1, x2, x3)) - 1, X1 = Math.ceil(Math.max(x1, x2, x3)) + 1, Y0 = Math.floor(Math.min(y1, y2, y3)) - 1, Y1 = Math.ceil(Math.max(y1, y2, y3)) + 1;
    for (var y = Y0; y <= Y1; y++) for (var x = X0; x <= X1; x++) {
      var px = x + 0.5, py = y + 0.5, a = sg(px, py, x1, y1, x2, y2), b = sg(px, py, x2, y2, x3, y3), d = sg(px, py, x3, y3, x1, y1);
      if (!(Math.min(a, b, d) < 0 && Math.max(a, b, d) > 0)) this.s(x, y, c, over);
    }
  };
  Buf.prototype.pts = function (c, list, over) { for (var i = 0; i < list.length; i++) this.s(list[i][0], list[i][1], c, over); };

  // 1px outline: every empty pixel 4-adjacent to a filled non-outline pixel. Result is padded by 1.
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

  // soft diagonal bands of stripe colour on fur pixels inside a rect
  function bands(b, x0, y0, x1, y1, per, thick, dir) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (b.g(x, y) !== FUR) continue;
      var k = dir > 0 ? x + y : x - y;
      if (((k % per) + per) % per < thick) b.s(x, y, STR);
    }
  }
  function limb(b, x1, y1, x2, y2, r, c) {
    var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1) * 2;
    for (var i = 0; i <= n; i++) b.sq(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, r, r, c, 2);
  }
  // thin tail, 6 samples per segment, 2 darker rings (as in cute.py)
  function tailDraw(b, path, r) {
    var pts = [], n, i, k;
    for (i = 0; i < path.length - 1; i++) for (k = 0; k < 6; k++) pts.push([path[i][0] + (path[i + 1][0] - path[i][0]) * k / 6, path[i][1] + (path[i + 1][1] - path[i][1]) * k / 6]);
    n = pts.length; var r1 = Math.round(n * 0.4), r2 = Math.round(n * 0.667);
    for (i = 0; i < n; i++) b.sq(pts[i][0], pts[i][1], r, r, (i === r1 || i === r1 + 1 || i === r2 || i === r2 + 1) ? STR : FUR, 2);
  }

  /* ---------- head (cute.py coordinates; head origin ox,oy shifts everything) ---------- */
  function headBase(b, ox, oy, o) {
    function T(p) { return p.map(function (q) { return [q[0] + ox, q[1] + oy]; }); }
    var fl = !!o.ear;
    b.tri(T(fl ? [[11, 3], [7, 12], [17, 6]] : [[10, 1], [7, 12], [17, 6]]), FUR);
    b.tri(T([[34, 1], [37, 12], [27, 6]]), FUR);
    b.sq(ox + 22, oy + 15.5, 15, 11.5, FUR, 2.4);
    b.tri(T(fl ? [[11.2, 5.4], [9, 9.5], [14.2, 6.6]] : [[10.6, 3.6], [9, 9.5], [14.2, 6.6]]), PNK);
    b.tri(T([[33.4, 3.6], [35, 9.5], [29.8, 6.6]]), PNK);
    b.sq(ox + 22, oy + 21, 7.8, 5.2, WHT, 2.2, [FUR]);
    b.tri(T([[22, 9.5], [20, 17.5], [24, 17.5]]), WHT, [FUR]);
    b.pts(STR, T([[22, 5], [22, 6], [22, 7], [19, 6], [19, 7], [25, 6], [25, 7]]));
    b.pts(STR, T([[8, 17], [9, 17], [8, 19], [9, 19], [35, 17], [36, 17], [35, 19], [36, 19]]));
    if (!fl) b.pts(FURL, T([[14, 6], [15, 6], [16, 5], [17, 5]]));
    else b.pts(FURL, T([[14, 6], [15, 6], [16, 5], [17, 5]]));
  }
  function expOf(o) {
    var e = o.expr || 'open', mo = !!o.mo, eyes = e;
    if (e === 'half') eyes = 'open';
    if (e === 'slow') eyes = 'drowsy';
    if (e === 'meow') { eyes = o.pose === 'stretch' ? 'happy' : 'open'; mo = true; }
    return { eyes: eyes, mo: mo };
  }
  function faceDraw(b, ox, oy, o) {
    var x = expOf(o), E = EYE, ex, i, P = function (c, list) { b.pts(c, list.map(function (q) { return [q[0] + ox, q[1] + oy]; })); };
    P(WSH, [[21, 26], [22, 26], [23, 26]]);
    [13, 28].forEach(function (ex) {
      if (x.eyes === 'open') {
        P(E, [[ex, 14], [ex + 1, 14], [ex - 1, 15], [ex + 2, 15], [ex - 1, 16], [ex + 2, 16], [ex - 1, 17], [ex + 2, 17], [ex, 18], [ex + 1, 18]]);
        P(GRN, [[ex + 1, 15], [ex, 16], [ex, 17]]); P(E, [[ex + 1, 16], [ex + 1, 17]]); P(HI, [[ex, 15]]);
      } else if (x.eyes === 'drowsy') {
        P(E, [[ex - 1, 16], [ex, 16], [ex + 1, 16], [ex + 2, 16], [ex - 1, 17], [ex + 2, 17], [ex, 18], [ex + 1, 18]]); P(GRN, [[ex, 17], [ex + 1, 17]]);
      } else if (x.eyes === 'happy') P(E, [[ex - 1, 17], [ex, 16], [ex + 1, 16], [ex + 2, 17]]);
      else if (x.eyes === 'sleep') P(E, [[ex - 1, 16], [ex, 17], [ex + 1, 17], [ex + 2, 16]]);
      else P(E, [[ex - 1, 17], [ex, 17], [ex + 1, 17], [ex + 2, 17]]); // blink
    });
    P(PNK, [[21, 19], [22, 19]]); P(FRK, [[23, 19]]);
    if (x.mo) { P(OUT, [[21, 20], [22, 20], [23, 20], [21, 21], [23, 21], [22, 22]]); P(PNK, [[22, 21]]); }
    else P(OUT, [[22, 20], [20, 21], [21, 21], [23, 21], [24, 21]]);
    P(BLU, [[12, 20], [13, 20], [31, 20], [32, 20]]);
  }

  /* ---------- accessories ---------- */
  var ACC = {};
  ACC.crown = function () {
    var b = new Buf(16, 10);
    b.poly([[0, 9], [0, 1], [3, 5], [5, 2], [7, 0], [8, 0], [10, 2], [12, 5], [15, 1], [15, 9]], 20);
    b.rect(0, 5, 16, 5, 20); b.rect(0, 9, 16, 1, 21); b.rect(0, 5, 16, 1, 22);
    b.s(0, 1, 22); b.s(7, 0, 22); b.s(8, 0, 22); b.s(15, 1, 22); b.s(5, 2, 22); b.s(10, 2, 22);
    b.rect(6, 6, 4, 3, 24); b.s(6, 6, 22);
    b.rect(2, 6, 2, 2, 23); b.rect(12, 6, 2, 2, 23); b.s(4, 7, 25); b.s(11, 7, 25);
    b.s(1, 8, 21); b.s(14, 8, 21);
    return finish(b);
  };
  function drawSticker(b, x, y) {
    b.ell(x + 2.5, y + 2.5, 2.5, 2.5, 28); b.s(x + 1, y + 1, 29); b.s(x + 2, y + 1, 29);
    [[1, 0], [2, 0], [3, 0], [4, 0], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [0, 2], [0, 3], [0, 4], [5, 1], [5, 2], [5, 3], [5, 4]]
      .forEach(function (p) { b.s(x + p[0], y + p[1], 2); });
  }
  // out has its origin shift set; (ox,oy) = head origin in that frame
  function accHead(out, acc, ox, oy) {
    if (!acc) return;
    if (acc.head === 'sticker') drawSticker(out, ox + 19, oy + 8);
    if (acc.head === 'crown') out.blit(ACC.crown(), ox + 14 + out.tx - 1, oy - 2 + out.ty - 1);
  }

  /* ---------- pose canvas: layers share one frame; out.tx/ty map frame coords onto the padded output ---------- */
  function Pose(W, H, tx, ty) { this.W = W; this.H = H; this.tx = tx; this.ty = ty; this.out = new Buf(W + 2, H + 2); this.out.tx = tx + 1; this.out.ty = ty + 1; }
  // cut = frame y: outline pixels of this layer above it are dropped, so a leg grows out of the body instead of being stuck on
  Pose.prototype.layer = function (fn, cut) {
    var b = new Buf(this.W, this.H); b.tx = this.tx; b.ty = this.ty; fn(b);
    var f = finish(b), o = this.out, i, y;
    for (i = 0; i < f.d.length; i++) {
      if (!f.d[i]) continue;
      y = Math.floor(i / f.w) - 1 - this.ty;
      if (cut != null && f.d[i] === OUT && y < cut) continue;
      o.d[i] = f.d[i];
    }
    return this;
  };
  Pose.prototype.head = function (ox, oy, o) { // separate outlined head + face + accessory
    var self = this;
    this.layer(function (b) { headBase(b, ox, oy, o); });
    faceDraw(this.out, ox, oy, o); accHead(this.out, o.acc, ox, oy);
    return this;
  };
  Pose.prototype.res = function (ax, G, hx, hy, extra) {
    var r = { buf: this.out, ax: ax + this.tx + 1, ay: G + this.ty + 2, head: { x: hx + 7 + this.tx + 1, y: hy + 4 + this.ty + 1, w: 30, h: 23 } };
    for (var k in extra) r[k] = extra[k];
    return r;
  };

  /* ---------- limb vocabulary (dev/concept/limbs.py): bean paws, soles, thigh arcs ---------- */
  // paw = its own outlined layer (never merges with body/bib); toe notches on its bottom row
  function bean(P, cx, cy, rx, ry, far) {
    P.layer(function (b) { b.sq(cx, cy, rx, ry, far ? WSH : WHT); });
    var o = P.out, x, y, fy = null, xs = [], x0 = Math.round(cx - rx) - 1, x1 = Math.round(cx + rx) + 1;
    for (y = -P.ty; y < P.H - P.ty; y++) for (x = x0; x <= x1; x++) { var v = o.g(x, y); if (v === WHT || v === WSH) { fy = y; break; } }
    if (fy === null) return;
    for (x = -P.tx; x < P.W - P.tx; x++) { var u = o.g(x, fy); if ((u === WHT || u === WSH) && Math.abs(x + 0.5 - cx) <= rx + 0.5) xs.push(x); }
    if (xs.length < 4) return;
    var m = xs[0], w = xs.length, ks = w <= 5 ? [1, 3] : w === 6 ? [1, 4] : [2, w - 3];
    ks.forEach(function (k) { o.s(m + k, fy, OUT); });
  }
  // paw seen from below (raised / belly-up): white bean + pink main pad + 3 toe dots
  function sole(P, cx, cy) {
    P.layer(function (b) { b.sq(cx, cy, 3.3, 2.9, WHT); });
    var m = Math.round(cx - 0.5);
    P.out.pts(PNK, [[m - 1, cy + 0.6], [m, cy + 0.6], [m + 1, cy + 0.6], [m, cy + 1.6], [m - 2, cy - 1.4], [m, cy - 2.2], [m + 2, cy - 1.4]]);
  }
  // thigh line: part of an ellipse edge, angles in degrees, 90 = down; drawn on the finished pose buffer
  function arc(P, cx, cy, rx, ry, a0, a1, c) {
    var n = Math.floor(Math.abs(a1 - a0) / 2) + 1;
    for (var i = 0; i <= n; i++) { var t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; P.out.s(cx + rx * Math.cos(t) - 0.5, cy + ry * Math.sin(t) - 0.5, c); }
  }
  function thigh(P, cx, cy) { arc(P, cx, cy, 6, 5.6, -110, 70, OUT); arc(P, cx, cy, 3.4, 3, -100, -10, STR); }

  /* ---------- poses ---------- */
  function poseSit(o) {
    var br = o.br ? 1 : 0, tw = o.tw ? 1 : 0, paw = o.paw || '', P = new Pose(60, 54, 7, 7);
    var wave = paw.indexOf('bat') === 0, groom = paw.indexOf('groom') === 0, f = /1$/.test(paw) ? 1 : 0, legs = [];
    P.layer(function (b) { tailDraw(b, [[30, 39.2], [33.5, 39.8], [37, 39.6], [39.6, 38.2], [40.8 + tw * 0.8, 35.8 - tw], [40.2 + tw * 1.2, 33.6 - tw * 1.4]], 1.8); });
    P.layer(function (b) { b.sq(10.8, 35.6, 6.8, 6.4, FUR); b.sq(33.2, 35.6, 6.8, 6.4, FUR); b.pts(STR, [[5, 33], [6, 32], [7, 31], [5, 36], [39, 33], [38, 32], [37, 31], [39, 36]]); }); // big round haunches (user picked B): the body outline draws the thigh line
    P.layer(function (b) {
      b.sq(22, 32.5, 11, 9, FUR, 2.2);
      headBase(b, 0, -br, o);
      b.pts(STR, [[12, 30], [13, 30], [12, 32], [32, 30], [31, 30], [32, 32]]);
    });
    if (!wave) legs.push(19);
    if (!groom) legs.push(25);
    legs.forEach(function (x) { P.layer(function (b) { limb(b, x, 30, x, 38.5, 2.5, FUR); }, 34); }); // front legs grow out of the chest
    P.out.sq(22, 29.5, 5.2, 5.6, WHT, 2, [FUR]); // cream chest painted over the leg tops
    faceDraw(P.out, 0, -br, o); accHead(P.out, o.acc, 0, -br);
    bean(P, 10.5, 40.8, 3, 1.7); bean(P, 33.5, 40.8, 3, 1.7);
    legs.forEach(function (x) { bean(P, x, 40.4, 3.4, 1.9); });
    if (wave) { // short thick arm, paw up by the cheek showing its pads
      var up = f ? 3 : 0;
      P.layer(function (b) { limb(b, 13.5, 33, 11, 29 - up, 2.5, FUR); });
      sole(P, 9.5, 26 - up);
    }
    if (groom) { // paw up at the cheek, tongue on frame 1
      P.layer(function (b) { limb(b, 30.5, 35, 30, 28, 2.5, FUR); });
      P.layer(function (b) { b.sq(29, 24.6 - f, 3.2, 2.6, WHT); });
      if (f) P.out.pts(PNK, [[25, 23 - br], [25, 22 - br]]);
    }
    return P.res(22, 41, 0, -br);
  }

  function poseLoaf(o) {
    var br = o.br ? 1 : 0, tw = o.tw ? 1 : 0, P = new Pose(60, 50, 7, 5);
    P.layer(function (b) {
      tailDraw(b, [[36, 40], [40.5, 39.5], [43, 36.5], [42.5 + tw, 33 - tw]], 1.7);
      b.sq(22, 33, 17.5, 8.2, FUR, 2.4);
      b.sq(22, 34.5, 5.5, 5, WHT, 2, [FUR]);
      headBase(b, 0, 3 - br, o);
      b.pts(STR, [[8, 36], [9, 36], [10, 37], [35, 36], [36, 36], [34, 37], [6, 33], [7, 33], [37, 33], [38, 33]]);
    });
    faceDraw(P.out, 0, 3 - br, o); accHead(P.out, o.acc, 0, 3 - br);
    bean(P, 15.5, 40.5, 3.2, 1.8); bean(P, 28.5, 40.5, 3.2, 1.8);
    return P.res(22, 41, 0, 3 - br);
  }

  function poseLie(o) {
    var br = o.br ? 0.6 : 0, tw = o.tw ? 1 : 0, pt = o.pt ? 1 : 0, P = new Pose(72, 46, 9, 4), ry = 8.7 + br, G = 38, hx = 17, hy = 6;
    P.layer(function (b) { tailDraw(b, [[5, 34.5], [0.5, 36.5], [-3.5, 36.8], [-7, 35 - tw * 1.5]], 1.7); });
    P.layer(function (b) {
      b.sq(18, G - ry + 0.5, 17, ry, FUR, 2.2);
      b.sq(21, G - 2, 11.5, 2.4, WHT, 2, [FUR]);
      bands(b, 3, G - 19, 26, G - 8, 8, 2, 1);
    });
    arc(P, 9.5, 30.5, 6.5, 6, -110, 75, OUT); arc(P, 9.5, 30.5, 3.8, 3.4, -100, -10, STR); // thigh = a curved line
    bean(P, 16, G - 1.4, 3.2, 1.6); // hind foot tucked forward
    P.head(hx, hy, o);
    [34.5, 41].forEach(function (x, i) { // forearms reach out under the chin; pt twitches the second paw
      var t = i ? pt : 0;
      P.layer(function (b) { limb(b, x - 7, G - 2.8, x - 2 + t, G - 2.8 - t, 2.3, FUR); });
      bean(P, x + t, G - 1.5 - t, 3, 1.8);
    });
    return P.res(26, G, hx, hy);
  }

  function poseBellyUp(o) {
    var br = o.br ? 1 : 0, wg = o.wg ? 1 : 0, hug = !!o.hug, P = new Pose(56, 60, 6, 4), G = 49, hx = 0, hy = 1;
    P.layer(function (b) { tailDraw(b, [[33, 45], [38, 47.5], [42, 46], [44 + wg, 42.5 - wg]], 1.7); });
    P.layer(function (b) {
      b.sq(22, 36, 15.5, 12.5 + br * 0.4, FUR, 2.2);
      b.sq(22, 37, 10.5, 9 + br * 0.4, BEL, 2.1);
      b.pts(BEL2, [[20, 40], [21, 40], [24, 43]]);
      b.pts(STR, [[8, 36], [9, 36], [8, 38], [36, 36], [35, 36], [36, 38]]);
    });
    var w = wg ? 1 : 0; // wiggle: arms and soles move 1px
    P.layer(function (b) { b.sq(10.5 - w, 44.5, 5.2, 4.6, FUR); b.sq(33.5 + w, 44.5, 5.2, 4.6, FUR); }); // bent hind legs
    sole(P, 8.5 - w, 41.5); sole(P, 36.5 + w, 41.5); // soles up
    P.head(hx, hy, { expr: o.expr, ear: o.ear, mo: o.mo, acc: o.acc, pose: 'bellyUp' });
    [1, -1].forEach(function (sx) {
      var ay = sx > 0 ? w : -w;
      if (hug) { // both paws meet just above the belly centre
        P.layer(function (b) { limb(b, 22 - sx * 11, 30.5, 22 - sx * 6, 32.6, 2.5, FUR); });
        bean(P, 22 - sx * 3.3, 32.8, 2.8, 1.7);
      } else {
        P.layer(function (b) { limb(b, 22 - sx * 11, 30.5, 22 - sx * 13.5, 27 + ay, 2.6, FUR); });
        sole(P, 22 - sx * 14.5, 24.5 + ay);
      }
    });
    return P.res(22, G, hx, hy, { belly: { x: 11 + 7, y: 28 + 5, w: 22, h: 18 } });
  }

  // side body shared by walk / eat / crouch / leap / bow. Head is the big front face.
  function poseSide(o) {
    var mode = o.mode || 'walk', f = o.f || 0, tw = o.tw ? 1 : 0, P = new Pose(80, 56, 10, 5), G = 44, bx = 18, by = 30, dy = 0;
    var hx = 12, hy = 10, tail, legs, far, near, shape = 'std', rump = o.rump || 0;
    if (mode === 'walk') {
      var a = [3, 0, -3, 0][f], lA = f === 1 ? 2 : 0, lB = f === 3 ? 2 : 0; dy = (f % 2) ? -1 : 0;
      far = [[26 - a, G - 2 - lB, 26 - a, 38 + dy], [10 + a, G - 2 - lB, 10 + a, 38 + dy]];
      near = [[10 - a, G - 2 - lA, 10 - a, 38 + dy], [28 + a, G - 2 - lA, 28 + a, 38 + dy]];
      tail = [[4, 30 + dy], [0, 27 + dy], [-2, 21 + dy], [-1.5 + tw, 15 + dy], [0.5 + tw, 13 + dy]]; hy = 10 + dy; by = 30 + dy;
    } else if (mode === 'eat') {
      var c = o.chew ? 1 : 0; hx = 14; hy = 14 + c;
      far = [[24, G - 2, 24, 38], [13, G - 2, 13, 38]]; near = [[8, G - 2, 8, 38], [30, G - 2, 30, 38]];
      tail = [[4, 29], [0, 26], [-2, 20], [-1.5 + tw, 14], [0.5 + tw, 12]];
    } else if (mode === 'crouch') {
      by = 34; hx = 11; hy = 14 + 0; shape = 'low';
      far = [[26, G - 2, 26, 40], [12 + rump, G - 2, 12 + rump, 40]]; near = [[31, G - 2, 31, 40], [7 + rump, G - 2, 7 + rump, 40]];
      tail = [[4 + rump, 37], [-2 + rump, 38], [-7 + rump, 36 - tw], [-10 + rump, 33 - tw]];
    } else { // bow
      shape = 'bow'; hx = 14; hy = 14;
      far = [[44, G - 2, 28, 40], [14, G - 2, 14, 36]]; near = [[46, G - 1.5, 30, 41], [8, G - 2, 8, 36]];
      tail = [[3, 22], [0, 16], [-1, 10], [0.5 + tw, 6]];
    }
    function legL(set, isFar) { // stubby r2.5 leg + bean paw; near legs are cut so they grow out of the body
      set.forEach(function (l) {
        P.layer(function (b) { limb(b, l[2], l[3] - 2, l[0], l[1] - 1, 2.5, isFar ? STR : FUR); }, isFar ? null : l[3] - 1);
        bean(P, l[0] + 0.5, l[1] + 0.3, 3, 1.7, isFar);
      });
    }
    P.layer(function (b) { tailDraw(b, tail, 1.7); });
    legL(far, true);
    P.layer(function (b) {
      if (shape === 'bow') {
        b.sq(11, 27, 10.5, 9.5, FUR, 2.2); b.sq(21, 33, 11, 7.5, FUR, 2.2); b.sq(30, 37, 8, 5.5, FUR, 2.2);
        b.sq(20, 38, 9, 2.4, WHT, 2, [FUR]); bands(b, 3, 17, 22, 30, 8, 2, 1);
      } else if (shape === 'long') {
        b.sq(18, by, 17, 8.3, FUR, 2.2); b.sq(20, by + 6, 11, 2.2, WHT, 2, [FUR]); bands(b, 3, by - 9, 24, by + 3, 8, 2, 1);
      } else if (shape === 'low') {
        b.sq(18, by, 16, 8, FUR, 2.2); b.sq(20, by + 6, 11, 2.2, WHT, 2, [FUR]); bands(b, 3, by - 9, 24, by + 2, 8, 2, 1);
      } else {
        b.sq(bx, by, 15, 9.5, FUR, 2.2); b.sq(bx + 2, by + 8, 10.5, 2.6, WHT, 2, [FUR]); bands(b, 3, by - 10, 26, by + 3, 8, 2, 1);
      }
    });
    thigh(P, mode === 'bow' ? 10 : 10, mode === 'bow' ? 29 : by + 1.5);
    legL(near, false);
    var oo = { expr: o.expr, ear: o.ear, mo: o.mo, acc: o.acc, pose: o.pose };
    P.head(hx, hy, oo);
    return P.res(bx + 3, G, hx, hy);
  }

  function poseLeap(o) {
    var P = new Pose(80, 56, 10, 5), G = 44, by = 28, hx = 15, hy = 6;
    P.layer(function (b) { tailDraw(b, [[3, 27], [-3, 27], [-9, 29], [-14, 27]], 1.7); });
    P.layer(function (b) { limb(b, 27, 31, 33, 34, 2.4, STR); }); bean(P, 34.5, 34.6, 3, 1.7, true);
    P.layer(function (b) { limb(b, 9, 32, 4, 35, 2.4, STR); }); bean(P, 2.5, 35.6, 3, 1.7, true);
    P.layer(function (b) {
      b.sq(18, by, 17, 8.3, FUR, 2.2); b.sq(20, by + 6, 11, 2.2, WHT, 2, [FUR]); bands(b, 3, by - 9, 24, by + 3, 8, 2, 1);
    });
    thigh(P, 9, by + 1);
    P.layer(function (b) { limb(b, 7, 33, 1, 37, 2.5, FUR); }, 35); bean(P, -0.5, 37.6, 3, 1.7);
    P.head(hx, hy, { expr: o.expr, ear: o.ear, mo: o.mo, acc: o.acc, pose: o.pose });
    P.layer(function (b) { limb(b, 30, 32, 37, 36, 2.5, FUR); }); bean(P, 38.5, 36.6, 3, 1.7);
    return P.res(21, G, hx, hy);
  }

  function poseCurl(o) {
    var br = o.br ? 1 : 0, tw = o.tw ? 1 : 0, P = new Pose(64, 52, 6, 6), G = 42, hx = -2, hy = 12;
    P.layer(function (b) {
      b.sq(27, G - 13 - br * 0.8, 23, 13 + br * 0.8, FUR, 2.3);
      bands(b, 12, 14, 50, 36, 8, 2, 1);
      b.sq(36, 19, 7, 2.5, FURL, 2, [FUR]);
    });
    P.layer(function (b) { tailDraw(b, [[49, 33], [47, 39.5], [40, 42], [33, 41.5], [28 + tw, 39.5]], 1.9); });
    P.head(hx, hy, { expr: 'sleep', ear: o.ear, acc: o.acc, pose: 'curl' });
    bean(P, 14, G - 1.2, 3.4, 2); bean(P, 23, G - 1.2, 3.4, 2);
    return P.res(27, G, hx, hy);
  }

  // cardboard box with ส้ม peeking. vis (old units, head = 18 rows) -> rows of new head shown above the front panel
  function poseBox(o) {
    var C = 26, P0 = 38, PB = 54, vis = o.vis || 0, rows = Math.min(27, Math.round(vis * 1.45)), P = new Pose(52, 58, 0, 0);
    P.layer(function (b) { b.rect(C - 19, P0 - 6, 39, 8, 38); b.rect(C - 19, P0 - 6, 39, 1, 39); });
    var hy = P0 - 1 - rows;
    if (vis) {
      P.head(C - 22, hy, { expr: o.expr, ear: o.ear, acc: o.acc, pose: 'inBox' });
      if (rows > 20) { bean(P, C - 13, P0 - 1, 3.4, 2.2); bean(P, C + 13, P0 - 1, 3.4, 2.2); }
    }
    P.layer(function (b) {
      b.rect(C - 21, P0, 43, PB - P0, 37);
      b.rect(C - 21, P0, 43, 2, 39); b.rect(C - 21, PB - 3, 43, 3, 38);
      b.rect(C - 3, P0 + 2, 7, PB - P0 - 5, 39); b.rect(C - 3, P0 + 2, 7, 1, 40);
      b.rect(C - 14, P0 + 8, 3, 1, 38); b.rect(C + 12, P0 + 8, 3, 1, 38);
    });
    return P.res(C, PB, C - 22, hy, { box: true });
  }

  var BUILD = { sit: poseSit, loaf: poseLoaf, lieSide: poseLie, bellyUp: poseBellyUp, side: poseSide, curl: poseCurl, box: poseBox };

  function specToBuild(s) {
    var o = {}, k;
    for (k in s) o[k] = s[k];
    switch (s.pose) {
      case 'walk': o.mode = 'walk'; return poseSide(o);
      case 'eat': o.mode = 'eat'; return poseSide(o);
      case 'crouch': o.mode = 'crouch'; return poseSide(o);
      case 'leap': return poseLeap(o);
      case 'stretch': o.mode = 'bow'; return poseSide(o);
      case 'groom': o.paw = 'groom' + (s.f ? 1 : 0); return poseSit(o);
      case 'bat': o.paw = 'bat' + (s.f ? 1 : 0); return poseSit(o);
      case 'inBox': return poseBox(o);
      default: return BUILD[s.pose](o);
    }
  }

  function toCanvas(buf) {
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
    var key = [spec.pose, spec.f || 0, spec.expr || 'open', spec.br ? 1 : 0, spec.tw || 0, spec.ear ? 1 : 0, spec.mo ? 1 : 0,
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

  function accIcon(id) {
    var buf = ACC[id] ? ACC[id]() : null;
    if (id === 'sticker') { buf = new Buf(10, 10); buf.ell(4.5, 4.5, 4, 4, 28); buf.s(2, 2, 29); buf.s(3, 2, 29); buf.s(2, 3, 29); buf = finish(buf); }
    return buf ? toCanvas(buf).cv : null;
  }

  root.SomSprites = { Buf: Buf, PAL: PAL, build: specToBuild, get: get, accIcon: accIcon, ACC: ACC, toCanvas: toCanvas, finish: finish };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SomSprites;
})(typeof window !== 'undefined' ? window : this);
