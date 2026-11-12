/* main.js - wires everything: loop, input, sheets, toys, save. */
(function () {
  'use strict';
  var S = SomState, R = SomRoom, Cat = SomCat, Fx = SomFx, A = SomAudio, IC = SomIcons, SP = SomSprites, UI = SomUI, $ = UI.$, el = UI.el;
  var Q = new URLSearchParams(location.search), DEMO = Q.get('demo') || '', DEBUG = Q.get('debug') === '1', PQ = Q.get('phase');
  var scene = Q.get('garden') === '1' ? 'garden' : 'house', sw = null; // scene is never saved: the game always opens in the house (?garden=1 is a test override); sw = fade in progress
  var HOURS = { dawn: 6, morning: 9, day: 13, evening: 17, night: 22 };
  if (PQ && !HOURS[PQ]) PQ = null;
  if (!PQ && Q.get('night') === '1') PQ = 'night'; else if (!PQ && Q.get('night') === '0') PQ = 'day'; // test override

  /* ---------- storage (silent failures) ---------- */
  var store = {
    get: function () { try { return localStorage.getItem(S.SAVE_KEY); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(S.SAVE_KEY, v); } catch (e) {} }
  };
  var state = DEMO ? S.defaults(Date.now()) : S.parse(store.get(), Date.now());
  var saveT = 0;
  function save() { clearTimeout(saveT); saveT = 0; if (DEMO) return; state.lastSeen = Date.now(); store.set(JSON.stringify(state)); }
  function dirty() { if (!saveT) saveT = setTimeout(save, 1000); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { save(); A.purr(false); } });
  window.addEventListener('pagehide', save);

  R.setScene(scene);

  /* ---------- time & phase ---------- */
  function hourNow() { return PQ ? HOURS[PQ] : new Date().getHours(); }
  var phase = PQ || S.phaseFor(hourNow()), prevPhase = null, fadeT = 1, hour = hourNow();

  /* ---------- canvas ---------- */
  var canvas = $('scene'), sctx = canvas.getContext('2d'), vc = document.createElement('canvas'), vx = vc.getContext('2d');
  vc.width = 128; vc.height = 160; vx.imageSmoothingEnabled = false;
  var cssScale = 3;
  var DPR_Q = parseFloat(Q.get('dpr')) || 0, VH = 160;
  function resize() {
    var st = $('stage'), aw = st.clientWidth, ah = st.clientHeight, dpr = DPR_Q || window.devicePixelRatio || 1;
    // integer device-pixel scale; virtual height 160..224 fills the space between the bars
    var s = Math.max(1, Math.min(Math.floor(aw * dpr / 128), Math.floor(ah * dpr / 160)));
    var vh = Math.max(160, Math.min(224, Math.floor(ah * dpr / s)));
    if (vh !== VH) {
      var dOld = R.D(), dNew = R.setH(vh); VH = vh; vc.height = VH; vx.imageSmoothingEnabled = false;
      if (dNew !== dOld && Cat.y) { Cat.y = Math.min(R.FLOOR.y1, Cat.y + (dNew - dOld) * (Cat.y > 120 ? 1 : 0.5)); Cat.interrupt(); }
    }
    canvas.width = 128 * s; canvas.height = VH * s; sctx.imageSmoothingEnabled = false;
    var cw = 128 * s / dpr, ch = VH * s / dpr, vp = $('vp');
    vp.style.width = cw + 'px'; vp.style.height = ch + 'px'; canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    cssScale = cw / 128; UI.setScale(cssScale, cw);
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  /* ---------- copy ---------- */
  var NAME = function () { return state.name || 'พ่อ'; };
  var LINES = {
    sun: ['อุ่นจัง~', 'แดดเช้าดีที่สุด'], fan: ['เย็นสบาย~', 'ลมพัดลมนี่แหละ'],
    pet: ['ครืดดด~', 'ตรงนั้นแหละ~', 'อีกนิดนึง~'], idle: ['เมี้ยว~', '…', 'ง่วงจัง', null, 'เกาคางหน่อย']
  };
  function rndOf(a) { return a[Math.floor(Math.random() * a.length)]; }
  function catAnchor() { return Cat.headTop(); }
  function say() {} // the family asked for no speech bubbles: ส้ม doesn't talk (meow face + hearts stay)
  Cat.onBubble = function (k) { if (LINES[k]) say(rndOf(LINES[k])); };
  function greeting() {
    var n = NAME();
    return { dawn: 'อรุณสวัสดิ์ ' + n, morning: n + 'มาแล้ว! เมี้ยว~', day: 'ร้อนจัง~ มานั่งหน้าพัดลมด้วยกันไหม', evening: n + 'กลับมาแล้ว~', night: 'Zzz…' }[phase];
  }

  /* ---------- hearts ---------- */
  var heartFrac = 0;
  var rubAcc = 0, rubAt = 0; // rub distance carries across short strokes (phones), reset after 1.5 s idle
  function showHearts() { $('heartN').textContent = state.hearts; }
  function giveHearts(n, x, y) {
    S.addHearts(state, n); showHearts(); dirty();
    var h = $('hearts'); h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump');
    if (x != null) Fx.hearts(x, y, Math.min(4, Math.ceil(n / 2)));
    if (!state.hints.pet) { state.hints.pet = true; hideHint(); }
  }

  /* ---------- hint hand ---------- */
  var hintOn = false;
  function showHint() { if (state.hints.pet || (DEMO && DEMO !== 'hint')) return; hintOn = true; $('hint').hidden = false; }
  function hideHint() { if (!hintOn) return; hintOn = false; $('hint').hidden = true; UI.hideBubble(); }
  function placeHint() { if (!hintOn) return; var p = Cat.headTop(); var h = $('hint'); h.style.left = (p.x * cssScale) + 'px'; h.style.top = (p.y * cssScale + 9 * cssScale) + 'px'; }

  /* ---------- pointer: petting / toys ---------- */
  var tool = null, pet = null, wand = null, box = null, food = null;
  function toV(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 128, y: (e.clientY - r.top) / r.height * VH }; }
  var lastVib = 0;

  canvas.addEventListener('pointerdown', function (e) {
    if (document.body.classList.contains('title') || UI.sheetOpen()) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    var v = toV(e);
    if (tool === 'wand') { wand.down = true; moveWand(v, true); return; }
    if (tool === 'box' && box && boxHit(v) && !Cat.hit(v.x, v.y)) { stowBox(); return; }
    var zone = Cat.hit(v.x, v.y);
    if (!zone && phase === 'night' && !tool && v.x >= R.STAR.x - 3 && v.x <= R.STAR.x + R.STAR.w + 3 && v.y >= R.STAR.y - 3 && v.y <= R.STAR.y + R.STAR.h + 3) { A.sparkle(); openMem(1); return; }
    pet = { id: e.pointerId, cx: e.clientX, cy: e.clientY, t0: performance.now(), moved: 0, acc: 0, zone: zone, lastHeart: 0, lastMove: 0, rub0: 0, belly0: 0, hugged: false, slow: false };
    if (zone) {
      hideHint();
      if (Cat.isAsleep()) { if (Cat.poke()) { say('หาวว~'); A.meow(); } }
      else if (Cat.isWalking() && !busyScript()) Cat.holdNow('sit', 7000);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    var v = toV(e);
    if (tool === 'wand' && wand.down) { moveWand(v, false); return; }
    if (!pet || pet.id !== e.pointerId) return;
    var now = performance.now(), d = Math.hypot(e.clientX - pet.cx, e.clientY - pet.cy);
    pet.cx = e.clientX; pet.cy = e.clientY; pet.moved += d;
    var zone = Cat.hit(v.x, v.y); pet.zone = zone;
    if (!zone) { pet.rub0 = 0; return; }
    if (now - pet.lastMove > 450) pet.rub0 = now;
    pet.lastMove = now;
    Cat.petting();
    if (now - rubAt > 1500) rubAcc = 0;
    rubAt = now; rubAcc += d;
    if (zone === 'belly') { if (!pet.belly0) pet.belly0 = now; if (!pet.hugged && now - pet.belly0 > 1500) { pet.hugged = true; Cat.react({ hug: 1 }, 1.8); say('จับได้แล้ว!'); A.pop(); } }
    if (rubAcc >= 45 && now - pet.lastHeart > 200) {
      rubAcc = 0; pet.lastHeart = now;
      heartFrac += zone === 'chin' ? 1.5 : 1;
      var n = Math.floor(heartFrac); heartFrac -= n;
      state.petsTotal++; giveHearts(n, v.x, v.y - 4); A.pop();
      if (Cat.isAsleep()) { Cat.poke(); }
      if (Math.random() < 0.25) say(zone === 'chin' ? 'เกาคางดีที่สุด' : rndOf(LINES.pet), 1400);
    }
    if (!pet.slow && pet.rub0 && now - pet.rub0 > 3000) {
      pet.slow = true; Cat.slowBlink();
      if (!state.hints.slowblink) { state.hints.slowblink = true; UI.caption('ส้มกะพริบตาช้าๆ ให้ แปลว่ารักนะ', 5000); dirty(); }
    }
  });
  function endPointer(e) {
    if (tool === 'wand' && wand && wand.down) { wand.down = false; return; }
    if (!pet || pet.id !== e.pointerId) return;
    var short = performance.now() - pet.t0 < 350 && pet.moved < 12;
    if (short && pet.zone && !Cat.isAsleep()) {
      Cat.slowBlink();
      if (Math.random() < 0.5) { var p = Cat.pose(); if (p === 'sit' || p === 'loaf' || p === 'lieSide') { Cat.react({ expr: 'meow', pose: p === 'lieSide' ? 'sit' : p }, 1.1); A.meow(); say(Math.random() < 0.5 ? 'เมี้ยว~' : NAME() + '~', 1400); } }
    }
    pet = null; A.purr(false);
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- treats ---------- */
  function busyScript() { return Cat.busy; }
  function giveTreat(tr) {
    var now = Date.now();
    if (S.isFull(state, now)) return;
    UI.closeSheet(); stopTool(true);
    var fr = S.feed(state, now); dirty();
    food = tr.id === 'rice' ? 'rice' : tr.id === 'fish' ? 'fish' : tr.id === 'chicken' ? 'chicken' : 'lick';
    var acc = 0;
    var steps = [{ t: 'goto', x: R.SPOT.bowls.x, y: R.SPOT.bowls.y, speed: 20 },
      { t: 'hold', pose: 'eat', dir: 1, ms: 3800, tick: function (dt) { acc += dt; if (acc > 0.5) { acc = 0; Fx.crumbs(Cat.x + 30, Cat.y - 5); A.crunch(); } } },
      { t: 'call', fn: function () { food = null; giveHearts(5, Cat.x + 20, Cat.y - 24); say(tr.say); if (fr.nowFull) setTimeout(function () { say('อิ่มแปล้แล้ว~', 2200); }, 1900); } }];
    if (fr.nowFull) steps.push({ t: 'hold', pose: 'bellyUp', expr: 'happy', ms: 18000 });
    Cat.run(steps, true);
    say('ง่ำ…', 1300);
  }
  function openTreats() {
    var body = el('div'), full = S.isFull(state, Date.now()), g = el('div', 'grid');
    if (full) body.appendChild(el('div', 'note', 'ส้มอิ่มแล้ว เดี๋ยวค่อยให้ใหม่นะ'));
    S.TREATS.forEach(function (tr) {
      var b = el('button', 'btn item'); b.appendChild(UI.icon(tr.id === 'rice' ? 'rice' : tr.id === 'fish' ? 'fish' : tr.id === 'chicken' ? 'chicken' : 'lick', 4)); b.appendChild(el('span', null, tr.name));
      if (full) b.disabled = true; b.addEventListener('click', function () { A.blip(); giveTreat(tr); }); g.appendChild(b);
    });
    body.appendChild(g); UI.openSheet('ให้ขนม', body);
  }

  /* ---------- play: wand & box ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function openPlay() {
    var body = el('div'), g = el('div', 'grid');
    [['wand', 'feather', 'ไม้ตกแมว'], ['box', 'box', 'กล่องกระดาษ']].forEach(function (it) {
      var b = el('button', 'btn item'); if (it[1] === 'box') { var c = document.createElement('canvas'); var m = SP.get({ pose: 'inBox', vis: 0 }); c.width = m.w; c.height = m.h; c.getContext('2d').drawImage(m.cv, 0, 0); var im = el('img', 'ic'); var k = document.createElement('canvas'); k.width = m.w * 2; k.height = m.h * 2; var kx = k.getContext('2d'); kx.imageSmoothingEnabled = false; kx.drawImage(c, 0, 0, k.width, k.height); im.src = k.toDataURL(); b.appendChild(im); }
      else b.appendChild(UI.icon(it[1], 2));
      b.appendChild(el('span', null, it[2])); b.addEventListener('click', function () { A.blip(); UI.closeSheet(); startTool(it[0]); }); g.appendChild(b);
    });
    body.appendChild(g); UI.openSheet('เล่น', body);
  }
  function showToybar(label) { $('toybar').hidden = !label; $('toyLabel').textContent = label || ''; }
  function startTool(name) {
    stopTool(true); tool = name;
    if (name === 'wand') { wand = { x: 64, y: 96 + Math.round(R.D() / 3), px: 64, py: 96, down: false, speed: 0, idle: 0, cool: 0, hover: 0, watch: false, acc: 0 }; showToybar('ลากนิ้วให้ส้มเล่น'); Cat.run([{ t: 'hold', pose: 'sit', expr: 'open', ms: Infinity }], true); }
    else { box = { x: 62, y: R.SPOT.center.y + 2, in: false, loops: 0 }; showToybar('แตะกล่องเพื่อเก็บ'); boxStart(); }
  }
  function stopTool(quiet) {
    if (!tool) return;
    var was = tool; tool = null; wand = null;
    if (was === 'box' && box) { var b = box; box = null; if (b.in) Cat.x = b.x - 24, Cat.y = b.y + 6; }
    showToybar(null); Cat.busy = false; Cat.interrupt(); if (!quiet) Cat.holdNow('sit', 4000);
  }
  $('btnStow').addEventListener('click', function () { A.blip(); stopTool(); });

  function moveWand(v, first) {
    var now = performance.now(), nx = clamp(v.x, 6, 122), ny = clamp(v.y, 20, VH - 10);
    wand.speed = Math.hypot(nx - wand.x, ny - wand.y) / Math.max(0.016, (now - (wand.t || now - 16)) / 1000); wand.t = now;
    wand.x = nx; wand.y = ny; wand.idle = 0;
  }
  function updateWand(dt) {
    var w = wand; w.idle += dt; w.cool -= dt;
    if (w.idle > 60) { stopTool(); return; }
    if (!w.down) { w.speed *= 0.9; }
    var gx = clamp(w.x, 18, 110), gy = clamp(w.y + 24, R.FLOOR.y0 + 4, R.FLOOR.y1);
    var d = Math.hypot(Cat.x - gx, (Cat.y - gy) * 1.4);
    if (Cat.step && Cat.step.pose === 'crouch' || Cat.step && Cat.step.t === 'leap' || Cat.step && Cat.step.t === 'call') return;
    if (d > 46) {
      w.hover = 0; w.retarget = (w.retarget || 0) - dt;
      if (w.retarget <= 0 || !Cat.isWalking()) { w.retarget = 0.7; Cat.run([Object.assign({ t: 'goto', speed: 28 }, Cat.avoid(gx - Math.sign(gx - Cat.x) * 30, gy)), { t: 'hold', pose: 'sit', expr: 'open', ms: Infinity }], true); }
    } else {
      if (Cat.isWalking() && d < 38) Cat.run([{ t: 'hold', pose: 'sit', expr: 'open', ms: Infinity }], true);
      if (Math.abs(w.x - Cat.x) > 4) Cat.dir = w.x > Cat.x ? 1 : -1;
      w.hover += dt;
      if (w.cool <= 0 && d < 34 && (w.speed > 35 || w.hover > 1.4)) pounce(gx, gy);
    }
  }
  function pounce(gx, gy) {
    wand.cool = 2.8; wand.hover = 0;
    var dir = gx >= Cat.x ? 1 : -1; Cat.dir = dir;
    Cat.run([{ t: 'hold', pose: 'crouch', dir: dir, ms: 520 },
      Object.assign({ t: 'leap', ms: 360, h: 12 }, Cat.avoid(gx - dir * 6, clamp(gy, R.FLOOR.y0, R.FLOOR.y1))),
      { t: 'call', fn: function () { giveHearts(3, Cat.x, Cat.y - 22); A.pop(); A.meow(); say(Math.random() < 0.5 ? 'จับได้!' : 'เมี้ยว!', 1300); } },
      { t: 'hold', pose: 'sit', expr: 'open', ms: 700 },
      { t: 'hold', pose: 'sit', expr: 'open', ms: Infinity }], true);
  }

  function boxRect() { return { x: box.x - 17, y: box.y - 20, w: 35, h: 24 }; }
  function boxHit(v) { var r = boxRect(); return v.x >= r.x - 3 && v.x <= r.x + r.w + 3 && v.y >= r.y - 14 && v.y <= r.y + r.h + 4; }
  function boxStart() {
    Cat.run([{ t: 'goto', x: box.x - 30, y: box.y + 4, speed: 22 },
      { t: 'leap', x: box.x, y: box.y, ms: 480, h: 16 },
      { t: 'call', fn: function () { box.in = true; giveHearts(3, box.x, box.y - 24); A.pop(); say('เมี้ยว~', 1300); } },
      { t: 'call', fn: boxLoop }], true);
  }
  function boxLoop() {
    if (!box || tool !== 'box') return;
    Cat.run([{ t: 'hold', pose: 'inBox', vis: 12, ms: 3500 + Math.random() * 2000 }, { t: 'hold', pose: 'inBox', vis: 19, ms: 2500 + Math.random() * 1500 }, { t: 'call', fn: boxLoop }], true);
  }
  function stowBox() {
    if (!box) return;
    var b = box; A.blip();
    if (b.in) { box = null; tool = null; showToybar(null); Cat.run([{ t: 'leap', x: b.x - 26, y: b.y + 6, ms: 420, h: 14 }, { t: 'hold', pose: 'sit', ms: 5000 }]); Cat.x = b.x; Cat.y = b.y; }
    else stopTool();
  }

  /* ---------- dress-up ---------- */
  function applyAcc() { Cat.acc = { head: state.equipped.head, neck: state.equipped.neck }; }
  function openDress() {
    var body = el('div'), g = el('div', 'grid');
    function build() {
      g.textContent = '';
      S.ITEMS.forEach(function (it) {
        var on = state.equipped[it.slot] === it.id, b = el('button', 'btn item' + (on ? ' sel' : '')); b.appendChild(UI.icon(it.id, 5)); b.appendChild(el('span', null, it.name));
        if (on) b.appendChild(el('span', null, 'ใส่อยู่'));
        b.addEventListener('click', function () { S.equip(state, it.id); applyAcc(); dirty(); A.sparkle(); var r = Cat.rects(); Fx.sparkle(r.head.x + r.head.w / 2, it.slot === 'neck' ? r.head.y + r.head.h : r.head.y); build(); });
        g.appendChild(b);
      });
    }
    build(); body.appendChild(g); UI.openSheet('แต่งตัว', body);
  }

  /* ---------- menu / name / memories ---------- */
  function openMenu() {
    var body = el('div'), g = el('div', 'grid one');
    var snd = el('button', 'btn paper'); function lbl() { snd.textContent = 'เสียง: ' + (state.sound ? 'เปิด' : 'ปิด'); } lbl();
    snd.addEventListener('click', function () { toggleSound(); lbl(); });
    var nm = el('button', 'btn paper', 'เปลี่ยนชื่อ'); nm.addEventListener('click', function () { UI.closeSheet(); openName(true); });
    g.appendChild(snd); g.appendChild(nm); body.appendChild(g); UI.openSheet('เมนู', body);
  }
  function toggleSound() { state.sound = !state.sound; A.setEnabled(state.sound); soundIcon(); dirty(); if (state.sound) A.blip(); }
  function soundIcon() { var b = $('btnSound'); b.textContent = ''; b.appendChild(UI.icon(state.sound ? 'speaker' : 'speakerOff', 3)); }

  var onName = null;
  function openName(edit, cb) {
    onName = cb || null; var s = $('nameScr'); s.hidden = false; $('nameType').hidden = true; $('nameBtns').hidden = false; $('nameCancel').hidden = !edit;
    $('nameQ').textContent = edit ? 'ให้ส้มเรียกว่าอะไรดี?' : 'ใครมาหาส้มจ๊ะ?';
  }
  function setName(n) {
    n = (n || '').trim(); if (!n) return; state.name = n.slice(0, 12); save(); $('nameScr').hidden = true;
    var f = onName; onName = null; if (f) f();
  }
  $('nameBtns').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.n) setName(b.dataset.n); });
  $('nameOwn').addEventListener('click', function () { $('nameBtns').hidden = true; $('nameType').hidden = false; $('nameIn').value = ''; setTimeout(function () { $('nameIn').focus(); }, 50); });
  $('nameOk').addEventListener('click', function () { setName($('nameIn').value); });
  $('nameIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') setName($('nameIn').value); });
  $('nameCancel').addEventListener('click', function () { $('nameScr').hidden = true; onName = null; });

  /* ---------- memories hub ---------- */
  var memTab = 0;
  function photos() { return window.SOM_PHOTOS || []; }
  function videos() { return window.SOM_VIDEOS || []; }
  function fmtDur(d) { d = Math.round(d || 0); return Math.floor(d / 60) + ':' + (d % 60 < 10 ? '0' : '') + (d % 60); }
  function openMem(tab) { $('mem').hidden = false; showTab(tab || 0); }
  function closeMem() { closeViewer(); $('mem').hidden = true; }

  var vw = { list: [], kind: 'photo', i: 0, sx: null };
  function openViewer(kind, i) { vw.kind = kind; vw.list = kind === 'video' ? videos() : photos(); vw.i = i; $('viewer').hidden = false; renderViewer(); }
  function stopVideo() {
    var v = $('vmedia').querySelector('video');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }
  }
  function renderViewer() {
    var m = vw.list[vw.i], box = $('vmedia'); if (!m) return;
    stopVideo(); box.textContent = '';
    if (vw.kind === 'video') {
      var v = document.createElement('video'); v.controls = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.preload = 'none';
      v.poster = m.poster; v.src = m.src; box.appendChild(v);
    } else { var im = el('img', null, null, { alt: m.caption || '', draggable: 'false' }); im.decoding = 'async'; im.src = m.src; box.appendChild(im); }
    $('vcap').textContent = m.caption || ''; $('vcount').textContent = (vw.i + 1) + ' / ' + vw.list.length;
    var many = vw.list.length > 1; $('vPrev').disabled = !many; $('vNext').disabled = !many;
  }
  function stepViewer(d) { var n = vw.list.length; if (n < 2) return; vw.i = (vw.i + d + n) % n; A.blip(); renderViewer(); }
  function closeViewer() { if ($('viewer').hidden) return; stopVideo(); $('vmedia').textContent = ''; $('viewer').hidden = true; }
  $('vPrev').addEventListener('click', function () { stepViewer(-1); });
  $('vNext').addEventListener('click', function () { stepViewer(1); });
  $('vClose').addEventListener('click', function () { A.blip(); closeViewer(); });
  $('vmedia').addEventListener('pointerdown', function (e) { vw.sx = e.target.tagName === 'VIDEO' ? null : { x: e.clientX, y: e.clientY }; });
  $('vmedia').addEventListener('pointerup', function (e) {
    if (!vw.sx) return; var dx = e.clientX - vw.sx.x, dy = e.clientY - vw.sx.y; vw.sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 70) stepViewer(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', function (e) {
    if ($('viewer').hidden) return;
    if (e.key === 'ArrowLeft') stepViewer(-1); else if (e.key === 'ArrowRight') stepViewer(1); else if (e.key === 'Escape') closeViewer();
  });

  function tabAlbum(body) {
    var ph = photos(), vd = videos();
    if (!ph.length && !vd.length) { body.appendChild(el('div', 'panel', 'ยังไม่มีรูป')); return; }
    if (vd.length) {
      body.appendChild(el('div', 'vhead', 'วิดีโอ'));
      var row = el('div', 'vrow');
      vd.forEach(function (v, i) {
        var b = el('button', 'vitem', null, { 'aria-label': 'เล่นวิดีโอ ' + (v.caption || '') });
        var im = el('img', 'poster', null, { loading: 'lazy', alt: '' }); im.src = v.poster; b.appendChild(im);
        var bd = UI.icon('play', 4, 'badge'); b.appendChild(bd); b.appendChild(el('span', 'dur', fmtDur(v.dur)));
        b.addEventListener('click', function () { A.blip(); openViewer('video', i); }); row.appendChild(b);
      });
      body.appendChild(row);
    }
    if (ph.length) {
      if (vd.length) body.appendChild(el('div', 'vhead', 'รูป'));
      var g = el('div', 'photos');
      ph.forEach(function (p, i) {
        var b = el('button', null, null, { 'aria-label': p.caption || 'รูปส้ม' }); var im = el('img', null, null, { loading: 'lazy', alt: '' }); im.src = p.thumb; b.appendChild(im);
        b.addEventListener('click', function () { A.blip(); openViewer('photo', i); }); g.appendChild(b);
      });
      body.appendChild(g);
    }
  }

  function tabStars(body) {
    var sky = el('div', 'sky');
    [[12, 18], [30, 70], [55, 30], [78, 90], [20, 100], [88, 22], [70, 60], [95, 80], [40, 14]].forEach(function (p) { var d = el('i'); d.style.left = p[0] + '%'; d.style.top = p[1] + '%'; sky.appendChild(d); });
    sky.appendChild(UI.icon('star', 6)); body.appendChild(sky);
    var ta = el('textarea', null, null, { id: 'msgIn', placeholder: 'เขียนถึงส้ม…', maxlength: '600', rows: '4', 'aria-label': 'เขียนถึงส้ม' });
    body.appendChild(ta);
    var send = el('button', 'btn wide teal', 'ส่งถึงดาวส้ม'); body.appendChild(send);
    var list = el('div', 'letters'); body.appendChild(list);
    function render() {
      list.textContent = '';
      var ms = state.messages.slice().reverse();
      if (!ms.length) { list.appendChild(el('div', 'panel', 'ยังไม่มีข้อความ เขียนถึงส้มได้เลยนะ')); return; }
      ms.forEach(function (m) {
        var c = el('div', 'panel letter'), meta = (m.name ? m.name + ' · ' : '') + S.thaiDate(new Date(m.at), false);
        c.appendChild(el('div', 'meta', meta)); c.appendChild(el('div', 'txt', m.text));
        var row = el('div', 'row'), del = el('button', 'btn paper', 'ลบ'); row.appendChild(del); c.appendChild(row);
        del.addEventListener('click', function () {
          row.textContent = ''; row.appendChild(el('b', null, 'ลบข้อความนี้?'));
          var yes = el('button', 'btn', 'ลบ'), no = el('button', 'btn paper', 'ไม่ลบ'); row.appendChild(yes); row.appendChild(no);
          yes.addEventListener('click', function () { S.deleteMessage(state, m.id); dirty(); render(); });
          no.addEventListener('click', render);
        });
        list.appendChild(c);
      });
    }
    send.addEventListener('click', function () {
      var m = S.addMessage(state, state.name, ta.value, Date.now());
      if (!m) { ta.focus(); return; }
      ta.value = ''; dirty(); A.sparkle(); render();
    });
    render();
  }

  function tabProfile(body) {
    var p = el('div', 'panel'), m = SP.get({ pose: 'sit', expr: 'half', br: 0, acc: Cat.acc }), c = document.createElement('canvas');
    c.width = m.w * 3; c.height = m.h * 3; c.style.cssText = 'display:block;margin:0 auto 10px;image-rendering:pixelated;max-width:100%';
    var cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(m.cv, 0, 0, c.width, c.height); p.appendChild(c);
    var ul = el('ul', 'facts');
    [['ชื่อ', 'ส้ม'], ['ขนสีส้ม-ขาว', 'ถุงเท้าขาวทั้งสี่ขา'], ['ที่โปรด', 'นอนอาบแดดตอนเช้า, นอนหน้าพัดลมตอนบ่าย, นอนหงายโชว์พุง, ที่นอนกลม ๆ ของตัวเอง']].forEach(function (f) {
      var li = el('li'); li.appendChild(el('b', null, f[0] + ': ')); li.appendChild(document.createTextNode(f[1])); ul.appendChild(li);
    });
    var kv = el('li', 'kv'); kv.appendChild(el('b', null, 'ตำแหน่ง: ')); kv.appendChild(document.createTextNode('ราชาของบ้าน ')); kv.appendChild(UI.icon('crown', 2)); ul.appendChild(kv);
    var lv = el('li', 'kv'); lv.appendChild(el('b', null, 'ความรักที่ได้รับ: ')); lv.appendChild(UI.icon('heart', 3)); lv.appendChild(el('span', null, String(state.hearts))); ul.appendChild(lv);
    p.appendChild(ul);
    var f = el('div', 'foot'); f.appendChild(el('div', null, 'ส้มกลับดาวแมว 10 พฤศจิกายน 2569')); f.appendChild(el('div', null, 'ส้มจะอยู่ในบ้านหลังนี้ และในใจทุกคนตลอดไป')); p.appendChild(f);
    body.appendChild(p);
  }

  function showTab(i) {
    memTab = i; var body = $('memBody'); body.textContent = ''; body.scrollTop = 0;
    Array.prototype.forEach.call($('memTabs').children, function (b, k) { b.classList.toggle('on', k === i); });
    [tabAlbum, tabStars, tabProfile][i](body);
  }
  $('memTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { A.blip(); showTab(+b.dataset.tab); } });
  $('memClose').addEventListener('click', function () { A.blip(); closeMem(); });

  /* ---------- memory of the day ---------- */
  var motdAfter = null;
  function maybeMotd(after) {
    var ph = photos();
    if (!ph.length || !S.needMotd(state, Date.now())) { if (after) after(); return; }
    var p = ph[S.memoryIndex(new Date(), ph.length)];
    S.markMotd(state, Date.now()); dirty();
    $('motdImg').src = p.src; $('motdCap').textContent = p.caption || ''; $('motd').hidden = false; motdAfter = after || null;
  }
  function closeMotd() { $('motd').hidden = true; $('motdImg').removeAttribute('src'); var f = motdAfter; motdAfter = null; if (f) setTimeout(f, 700); }
  $('motdClose').addEventListener('click', function () { A.blip(); closeMotd(); });
  $('motdAll').addEventListener('click', function () { A.blip(); closeMotd(); openMem(0); });

  /* ---------- house <-> garden ---------- */
  function sceneLabel() { var b = $('btnScene'), t = scene === 'garden' ? 'เข้าบ้าน' : 'ไปสวน'; b.textContent = t; b.setAttribute('aria-label', t); }
  function goScene(to) {
    if (sw || to === scene) return;
    A.blip(); UI.closeSheet(); stopTool(true); hideHint();
    sw = { t: 0, to: to, done: false };
  }
  function applyScene(to) { scene = to; R.setScene(to); sceneLabel(); Cat.fit(); }
  function updateFade(dt) {
    sw.t += dt;
    if (!sw.done && sw.t >= 0.175) { sw.done = true; applyScene(sw.to); }
    if (sw.t >= 0.35) sw = null;
  }

  /* ---------- buttons ---------- */
  function wireButtons() {
    var ic = [['bTreat', 'fish', 2], ['bPlay', 'feather', 2], ['bDress', 'crown', 2], ['bMem', 'photo', 2]];
    ic.forEach(function (x) { $(x[0]).querySelector('.icw').appendChild(UI.icon(x[1], x[2])); });
    $('heartIc').src = IC.url('heart', 3); $('handIc').src = IC.url('hand', 4);
    $('bTreat').addEventListener('click', function () { A.blip(); openTreats(); });
    $('bPlay').addEventListener('click', function () { A.blip(); openPlay(); });
    $('bDress').addEventListener('click', function () { A.blip(); openDress(); });
    $('bMem').addEventListener('click', function () { A.blip(); openMem(0); });
    $('btnScene').addEventListener('click', function () { goScene(scene === 'garden' ? 'house' : 'garden'); });
    sceneLabel();
    $('btnSound').addEventListener('click', toggleSound); $('btnMenu').addEventListener('click', function () { A.blip(); openMenu(); });
    $('sheetClose').addEventListener('click', function () { UI.closeSheet(); }); $('scrim').addEventListener('click', function () { UI.closeSheet(); });
    soundIcon(); showHearts();
  }

  /* ---------- flow ---------- */
  var home = false;
  function enterHome(skipGreet) {
    document.body.classList.remove('title'); home = true; resize();
    if (skipGreet) return;
    setTimeout(function () {
      if (Cat.isAsleep()) { Cat.earFlick(); say('Zzz…', 2200); }
      else { var p = Cat.pose(); if (p !== 'bellyUp' && p !== 'inBox') Cat.react({ pose: 'sit', expr: 'meow' }, 2.4); A.meow(); say(greeting(), 2600); }
      setTimeout(function () { maybeMotd(showHint); }, 3300);
    }, 350);
  }
  $('btnEnter').addEventListener('click', function () {
    A.init(); A.setEnabled(state.sound); A.blip();
    $('title').hidden = true;
    if (!state.name) { document.body.classList.remove('title'); document.body.classList.add('title'); openName(false, function () { enterHome(); }); }
    else enterHome();
  });

  /* ---------- loop ---------- */
  var last = 0, tAll = 0, purrOn = false, idleT = 20, phaseChk = 0;
  function update(dt) {
    tAll += dt;
    phaseChk += dt;
    if (phaseChk > 5 && !PQ) {
      phaseChk = 0; var np = S.phaseFor(new Date().getHours());
      hour = new Date().getHours();
      if (np !== phase) { prevPhase = phase; phase = np; fadeT = 0; Cat.setPhase(phase, hour); }
    }
    if (sw) updateFade(dt);
    if (fadeT < 1) { fadeT = Math.min(1, fadeT + dt / 2); if (fadeT >= 1) prevPhase = null; }
    Cat.update(dt);
    if (tool === 'wand' && wand) updateWand(dt);
    if (box && box.in) { Cat.x = box.x; Cat.y = box.y; }
    Fx.update(dt);
    // purr + vibrate while rubbing
    var rubbing = pet && pet.zone && performance.now() - pet.lastMove < 350;
    if (rubbing !== purrOn) { purrOn = rubbing; A.purr(rubbing); }
    if (rubbing && performance.now() - lastVib > 400) { lastVib = performance.now(); try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {} }
    // idle chatter
    idleT -= dt;
    if (idleT <= 0 && home && !UI.sheetOpen() && !hintOn && !DEMO) {
      idleT = 25 + Math.random() * 25;
      if (!Cat.isAsleep() && !tool) { var l = rndOf(LINES.idle); if (l === null) l = NAME() + '~'; say(l, 1600); if (Math.random() < 0.4) A.meow(); }
    }
  }
  function draw() {
    var ctx = vx, ph = R.PH[phase], pp = prevPhase ? R.PH[prevPhase] : null, gd = scene === 'garden';
    R.drawBg(ctx, phase, prevPhase, fadeT);
    if (!gd) { // the bed, fan and sun beam belong to the house; the bowls are in both scenes
      R.drawBed(ctx);
      R.drawBeam(ctx, hour, pp ? pp.beam + (ph.beam - pp.beam) * fadeT : ph.beam);
    }
    var list = [{ y: 146.5 + R.D(), f: function () { R.drawBowls(ctx, food); } }];
    if (!gd) list.push({ y: 104, f: function () { R.drawFan(ctx, ph.fan, tAll); } });
    var inBox = box && box.in && Cat.pose() === 'inBox';
    if (!inBox) list.push({ y: Cat.y, f: function () { Cat.draw(ctx); } });
    if (box) list.push({ y: box.y, f: function () {
      var m = SP.get(inBox ? { pose: 'inBox', vis: (Cat.step && Cat.step.vis) || 12, expr: Cat.petT > 0 ? 'happy' : 'half', acc: Cat.acc } : { pose: 'inBox', vis: 0 });
      R.shadow(ctx, box.x, box.y, 38); ctx.drawImage(m.cv, Math.round(box.x - m.ax), Math.round(box.y - m.ay));
    } });
    list.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < list.length; i++) list[i].f();
    if (!gd) R.drawBedFront(ctx);
    R.drawOverlay(ctx, phase, prevPhase, fadeT);
    if (phase === 'night') R.drawStars(ctx, tAll, state.messages, R.skyRect());
    Fx.draw(ctx);
    if (tool === 'wand' && wand) drawWand(ctx);
    if (sw) { ctx.globalAlpha = sw.t < 0.175 ? sw.t / 0.175 : Math.max(0, 1 - (sw.t - 0.175) / 0.175); ctx.fillStyle = '#1A2B47'; ctx.fillRect(0, 0, 128, VH); ctx.globalAlpha = 1; }
    sctx.drawImage(vc, 0, 0, canvas.width, canvas.height);
    UI.place(); placeHint();
  }
  function drawWand(ctx) {
    var w = wand, sway = Math.sin(tAll * 3) * (w.down ? 0 : 2), x = Math.round(w.x + sway), y = Math.round(w.y);
    ctx.fillStyle = '#5B3420'; for (var k = 0; k < 22; k += 2) ctx.fillRect(x + Math.round(k * 0.5), y - 4 - k - 6, 1, 1);
    var c = IC.canvas('feather'); ctx.drawImage(c, x - 7, y - 10 + Math.round(Math.sin(tAll * 5) * (w.down ? 1 : 0)));
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = 0; return; }
    if (ts - last < 32) return;
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.033; last = ts;
    update(dt); draw();
    if (DEBUG) dbg(dt);
  }
  var dbgEl, fps = 0;
  function dbg(dt) { if (!dbgEl) { dbgEl = el('div', 'dbg'); document.body.appendChild(dbgEl); } fps = fps * 0.9 + (1 / dt) * 0.1; dbgEl.textContent = phase + ' ' + Cat.pose() + ' ' + fps.toFixed(0) + 'fps ' + canvas.width + 'x' + canvas.height; }

  /* ---------- demos (dev only) ---------- */
  function stageMsgs() {
    var n = Date.now(); state.messages.push({ id: 'demo1', name: 'แม่', text: 'คิดถึงส้มนะลูก นอนหลับฝันดีนะ', at: n - 3600e3 }, { id: 'demo2', name: 'พ่อ', text: 'ส้มเป็นราชาของบ้านเราตลอดไป\nรักส้มมากนะ', at: n });
  }
  function applyDemo() {
    if (!DEMO) return;
    state.name = 'พ่อ'; showHearts();
    var forever = 1e9;
    if (DEMO === 'title') return;
    if (DEMO === 'name') { $('title').hidden = true; openName(false); return; }
    $('title').hidden = true; enterHome(true); state.hints.pet = DEMO !== 'hint';
    if (DEMO === 'hint') { Cat.holdNow('sit', forever); setTimeout(showHint, 200); }
    if (DEMO === 'crown') { state.equipped.head = 'crown'; applyAcc(); Cat.holdNow('sit', forever, { expr: 'half' }); }
    if (DEMO === 'sticker') { state.equipped.head = 'sticker'; applyAcc(); Cat.holdNow('sit', forever); }
    if (DEMO === 'pet') {
      Cat.x = 64; Cat.y = 126; Cat.holdNow('sit', forever); var n = 0;
      setInterval(function () { Cat.petting(); n++; if (n % 3 === 0) Fx.hearts(60 + Math.random() * 8, 100, 1); }, 250);
      setTimeout(function () { say('ครืดดด~', 60000); }, 300);
      Cat.petting();
    }
    if (DEMO === 'eat') { Cat.x = R.SPOT.bowls.x; Cat.y = R.SPOT.bowls.y; Cat.dir = 1; food = 'fish'; Cat.holdNow('eat', forever, { dir: 1 }); setTimeout(function () { say('ปลาทูของโปรด!', 60000); Fx.crumbs(Cat.x + 30, Cat.y - 5); }, 400); }
    if (DEMO === 'wand') { startTool('wand'); wand.x = 86; wand.y = 104; wand.cool = 1e9; Cat.x = 52; Cat.y = 128; Cat.run([{ t: 'hold', pose: 'crouch', dir: 1, expr: 'open', ms: forever }], true); wand.idle = -1e9; }
    if (DEMO === 'box') { startTool('box'); box.in = true; Cat.x = box.x; Cat.y = box.y; Cat.run([{ t: 'hold', pose: 'inBox', vis: 19, ms: forever }], true); }
    if (DEMO === 'full') { Cat.x = 80; Cat.y = 140; Cat.run([{ t: 'hold', pose: 'bellyUp', expr: 'happy', ms: forever }], true); setTimeout(function () { say('อิ่มแปล้แล้ว~', 60000); }, 300); }
    if (DEMO === 'sheet-treat') openTreats(); if (DEMO === 'sheet-dress') openDress(); if (DEMO === 'sheet-play') openPlay();
    if (DEMO === 'mem') openMem(+(Q.get('tab') || 0));
    if (DEMO === 'viewer') { openMem(0); openViewer('photo', +(Q.get('i') || 4)); }
    if (DEMO === 'video') { openMem(0); openViewer('video', +(Q.get('i') || 2)); }
    if (DEMO === 'stars' || DEMO === 'stars-home') { stageMsgs(); if (DEMO === 'stars') openMem(1); }
    if (DEMO === 'motd') { state.motd.date = ''; maybeMotd(null); }
  }

  /* ---------- boot ---------- */
  wireButtons(); resize();
  applyAcc(); Cat.reset(phase, hour);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  applyDemo();
  requestAnimationFrame(frame);
  window.__som = { goScene: goScene, scene: function () { return scene; }, tick: function (sec) { for (var t = 0; t < sec; t += 0.033) update(0.033); }, state: state, Cat: Cat, R: R, giveHearts: giveHearts, setPhase: function (p) { prevPhase = phase; phase = p; hour = HOURS[p]; fadeT = 0; Cat.reset(p, hour); } };
})();
