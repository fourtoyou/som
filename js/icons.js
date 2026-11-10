/* icons.js - pixel icons and small props (food, feather, ball-free toys). Drawn in code, no emoji. */
(function (root) {
  'use strict';
  var SP = root.SomSprites, Buf = SP.Buf, finish = SP.finish;
  var INK = '#3B2417';

  function cv(buf, pal) {
    var c = document.createElement('canvas'); c.width = buf.w; c.height = buf.h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(buf.w, buf.h);
    for (var i = 0; i < buf.d.length; i++) {
      var v = buf.d[i]; if (!v) continue;
      var h = pal[v] || '#ff00ff';
      img.data[i * 4] = parseInt(h.substr(1, 2), 16); img.data[i * 4 + 1] = parseInt(h.substr(3, 2), 16);
      img.data[i * 4 + 2] = parseInt(h.substr(5, 2), 16); img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c;
  }
  function fromRows(rows, map) {
    var b = new Buf(rows[0].length, rows.length), pal = [null], k, n = 1, idx = {};
    for (k in map) { idx[k] = n; pal[n++] = map[k]; }
    b.stamp(rows, 0, 0, idx);
    return cv(b, pal);
  }
  function outlined(w, h, pal, fn) { // pal[1] must be outline
    var b = new Buf(w, h); fn(b); return cv(finish(b), pal);
  }

  var DEF = {};
  DEF.heart = function () {
    return fromRows(['..oo.oo..', '.oRRoRRo.', 'oRHRRRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....'],
      { o: '#8F2A3C', R: '#E8566B', H: '#FFB3BD' });
  };
  DEF.hand = function () {
    return fromRows(['....oo......', '...oWWo.....', '...oWWo.....', '...oWWo.....', '...oWWooo...', '.o.oWWWWWoo.', 'oWooWWWWWWWo', 'oWWWWWWWWWWo',
      '.oWWWWWWWWWo', '..oWWWWWWWo.', '..oWWWWWWWo.', '...oWWWWWo..', '...ooooooo..'], { o: INK, W: '#FFF8EE' });
  };
  DEF.fish = function () {
    return outlined(18, 11, [null, INK, '#6F9BB5', '#D9E6EC', '#3E5F78', '#FFFFFF', '#1E242B'], function (b) {
      b.ell(7, 5, 7, 3.5, 2); b.ell(7, 7, 6, 1.5, 3, [2]); b.poly([[12, 5], [16, 1], [16, 9]], 2);
      [[4, 3], [6, 2], [8, 2], [10, 3], [5, 4], [9, 4]].forEach(function (p) { b.s(p[0], p[1], 4); });
      b.s(2, 4, 5); b.s(2, 4, 6);
    });
  };
  DEF.rice = function () {
    return outlined(14, 9, [null, INK, '#A0632B', '#C98A4B', '#7A4720'], function (b) {
      b.ell(6.5, 5, 6, 3, 2);
      [[3, 5], [5, 4], [8, 4], [10, 5], [6, 6], [4, 7], [8, 7], [6, 2], [7, 3]].forEach(function (p) { b.rect(p[0], p[1], 2, 1, 3); });
      [[2, 6], [9, 6], [5, 5]].forEach(function (p) { b.s(p[0], p[1], 4); });
    });
  };
  DEF.chicken = function () {
    return outlined(15, 14, [null, INK, '#D9894B', '#F2B46E', '#FFF6E8'], function (b) {
      b.thick([[8, 8], [12, 12]], 1, 4); b.ell(13, 12, 1.5, 1.5, 4); b.ell(11, 13, 1.5, 1.5, 4);
      b.ell(5, 5, 4.5, 4.5, 2); b.ell(4, 4, 2, 2, 3);
    });
  };
  DEF.lick = function () {
    return outlined(18, 10, [null, INK, '#2FA39E', '#E8566B', '#FFF6E8', '#F6C88A'], function (b) {
      b.rect(5, 1, 11, 7, 2); b.rect(1, 2, 4, 5, 3); b.rect(7, 3, 7, 3, 4); b.s(8, 4, 5); b.s(10, 4, 5);
      b.rect(16, 3, 1, 3, 5);
    });
  };
  DEF.feather = function () {
    return outlined(14, 20, [null, INK, '#F29CB5', '#FFD3DF', '#FFFFFF', '#8B5A2B'], function (b) {
      b.thick([[4, 18], [11, 10]], 0.5, 6 - 1);
      b.ell(9, 5, 3, 5.5, 2); b.ell(8, 5, 1, 4, 3);
      for (var y = 1; y < 10; y += 2) { b.s(5, y + 1, 2); b.s(13 - 1, y + 2, 2); }
      b.s(8, 3, 4);
    });
  };
  DEF.photo = function () {
    return outlined(14, 12, [null, INK, '#FFF8EE', '#8FD3E8', '#5DA06C', '#FFD27A'], function (b) {
      b.rect(0, 0, 14, 12, 2); b.rect(2, 2, 10, 6, 3); b.poly([[2, 7], [5, 4], [8, 7], [10, 5], [12, 7], [12, 7], [2, 7]], 4);
      b.rect(2, 7, 10, 1, 4); b.ell(9, 3.5, 1, 1, 5); b.s(6, 10, 3 + 0); b.rect(5, 9, 4, 1, 1);
    });
  };
  DEF.speaker = function () {
    return fromRows(['....oo.....', '...ooW.....', 'oooooW..o..', 'oWWWoW...o.', 'oWWWoW.o.o.', 'oWWWoW...o.', 'oooooW..o..', '...ooW.....', '....oo.....'].map(function (r) { return r; }),
      { o: INK, W: '#FFF8EE' });
  };
  DEF.speakerOff = function () {
    return fromRows(['....oo.....', '...ooW.....', 'oooooW.....', 'oWWWoW.R.R.', 'oWWWoW..R..', 'oWWWoW.R.R.', 'oooooW.....', '...ooW.....', '....oo.....'],
      { o: INK, W: '#FFF8EE', R: '#E8566B' });
  };
  DEF.star = function () {
    return fromRows(['....o....', '...oYo...', '...oYo...', 'ooooYoooo', 'oYYYYYYYo', '.ooYYYoo.', '..oYYYo..', '.oYYoYYo.', '.ooo.ooo.'], { o: '#A5521A', Y: '#FFB347' });
  };
  DEF.play = function () {
    return outlined(11, 11, [null, INK, '#FFF8EE', '#E9A35A'], function (b) { b.ell(5, 5, 5, 5, 2); b.poly([[4, 3], [4, 7], [8, 5]], 3); });
  };
  DEF.pawdot = function () { return fromRows(['.o..o.', 'oPo.oPo', '.o..o.'], { o: INK, P: '#FFF8EE' }); };

  var cache = {};
  function canvas(name) {
    if (cache[name]) return cache[name];
    var c = DEF[name] ? DEF[name]() : SP.accIcon(name);
    cache[name] = c; return c;
  }
  var urls = {};
  function url(name, scale) {
    var key = name + '@' + scale; if (urls[key]) return urls[key];
    var src = canvas(name), c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
    return (urls[key] = c.toDataURL());
  }
  root.SomIcons = { canvas: canvas, url: url, raw: cv };
})(window);
