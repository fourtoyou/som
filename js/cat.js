/* cat.js - ส้ม: a script-driven behaviour engine. Every activity (idle life, eating, toys) is a list of steps:
   goto / hold / leap / call. Natural behaviour picks a new script when the previous one ends. */
(function (root) {
  'use strict';
  var R = root.SomRoom, SP = root.SomSprites, Fx = root.SomFx, P = R.SPOT, F = R.FLOOR;
  var FLIP = { walk: 1, eat: 1, crouch: 1, leap: 1, stretch: 1, lieSide: 1 };
  var BASE = { sit: 'open', loaf: 'open', lieSide: 'sleep', curl: 'sleep', bellyUp: 'sleep', walk: 'open', eat: 'happy', crouch: 'open', leap: 'open', stretch: 'meow', groom: 'sleep', bat: 'open', inBox: 'open' };
  var SHADOW = { sit: 28, loaf: 32, lieSide: 40, bellyUp: 32, walk: 36, eat: 36, crouch: 36, leap: 30, stretch: 36, groom: 28, bat: 28 };
  function rr(a, b) { return a + Math.random() * (b - a); }
  function pick(w) { var r = Math.random(), s = 0; for (var i = 0; i < w.length; i++) { s += w[i][0]; if (r < s) return w[i][1]; } return w[w.length - 1][1]; }

  var Cat = {
    x: 62, y: 128, dir: 1, lift: 0, time: 0, phase: 'day', hour: 12, acc: { head: null, neck: null },
    steps: [], step: null, st: 0, ov: null, petT: 0, wakeAt: [], awakeUntil: 0, busy: false,
    nextBlink: 2, blinkUntil: 0, nextEar: 6, earUntil: 0, nextTw: 3, twUntil: 0, nextZ: 1, nextSlow: 20, slowUntil: 0, nextDrowsy: 30, drowsyUntil: 0, nextPaw: 4, pawUntil: 0,
    onBubble: null
  };

  /* ---------- scripts ---------- */
  function goto_(x, y) { return { t: 'goto', x: x, y: y }; }
  function hold(o, ms) { o.t = 'hold'; o.ms = ms; return o; }
  function inNogo(x, y, pad) {
    var a = R.nogo(), i, r;
    for (i = 0; i < a.length; i++) { r = a[i]; if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return true; }
    return false;
  }
  // a floor point that is not on a prop (the garden hose): pushed up above the prop if it is on one
  Cat.avoid = function (x, y) {
    var a = R.nogo(), i, r; x = Math.max(F.x0, Math.min(F.x1, x)); y = Math.max(F.y0, Math.min(F.y1, y));
    for (i = 0; i < a.length; i++) { r = a[i]; if (inNogo(x, y, 6)) y = Math.max(F.y0, r.y - 8); }
    return { x: x, y: y };
  };
  function wander() {
    var x = rr(F.x0, F.x1), y = rr(F.y0 + 6, F.y1), k = 0;
    if (R.scene() === 'garden') {
      while (inNogo(x, y, 6) && k++ < 20) { x = rr(F.x0, F.x1); y = rr(F.y0 + 6, F.y1); }
      if (inNogo(x, y, 6)) { x = P.center.x; y = P.center.y; }
      return [goto_(x, y), hold({ pose: 'sit' }, rr(5000, 9000))];
    }
    if (x > 92 && y < 112) y = rr(114, F.y1);
    if (x < 72 && y > P.bed.y - 32) y = rr(F.y0 + 6, P.bed.y - 32); // keep out of the (bigger) bed
    return [goto_(x, y), hold({ pose: 'sit' }, rr(5000, 9000))];
  }
  function awakeNight() { return pick([[0.4, [hold({ pose: 'sit' }, rr(8000, 12000))]], [0.7, [hold({ pose: 'groom' }, 7000)]], [1, [hold({ pose: 'stretch' }, 3000), hold({ pose: 'sit' }, 5000)]]]); }
  // garden: by day a mix of pot / hose / grass; at night asleep in the moonlight unless he was woken
  function gardenAct(phase) {
    if (phase === 'night') return Cat.time < Cat.awakeUntil ? awakeNight() : [goto_(P.gsleep.x, P.gsleep.y), hold({ pose: 'curl' }, Infinity)];
    // pick() sums these, so they are real weights (total 1)
    return pick([[0.25, [goto_(P.pot.x, P.pot.y), hold({ pose: 'sit', look: 1 }, rr(10000, 18000))]],
      [0.25, [goto_(P.hose.x, P.hose.y), hold({ pose: 'lieSide' }, rr(15000, 25000))]],
      [0.15, [goto_(rr(58, 82), rr(P.center.y - 14, P.center.y + 4)), hold({ pose: 'bellyUp' }, rr(10000, 16000))]],
      [0.12, [hold({ pose: 'loaf' }, rr(10000, 16000))]],
      [0.1, [hold({ pose: 'groom' }, rr(7000, 10000))]], [0.13, wander()]]);
  }
  function actFor(phase, hour) {
    var spot;
    if (R.scene() === 'garden') return gardenAct(phase);
    switch (phase) {
      case 'dawn':
        return pick([[0.3, [hold({ pose: 'groom' }, rr(7000, 10000))]],
          [0.55, [goto_(82, 142), hold({ pose: 'sit' }, rr(10000, 16000))]],
          [0.75, [hold({ pose: 'stretch' }, 3200), hold({ pose: 'sit' }, 5000)]],
          [1, wander()]]);
      case 'morning':
        spot = R.beamSpot(hour);
        return pick([[0.7, [goto_(spot.x, spot.y), hold({ pose: 'lieSide', say: 'sun' }, rr(15000, 25000))]],
          [0.9, [goto_(spot.x, spot.y), hold({ pose: 'loaf', say: 'sun' }, rr(10000, 16000))]], [1, wander()]]);
      case 'day':
        return pick([[0.5, [goto_(P.fan.x, P.fan.y), hold({ pose: 'lieSide', expr: 'open', say: 'fan' }, rr(14000, 25000))]],
          [0.72, [goto_(P.fan.x, P.fan.y + 2), hold({ pose: 'bellyUp', say: 'fan' }, rr(12000, 20000))]],
          [0.9, wander()], [1, [hold({ pose: 'sit' }, rr(8000, 12000))]]]);
      case 'evening':
        return pick([[0.35, [goto_(P.center.x, P.center.y), hold({ pose: 'sit', look: 1 }, rr(10000, 18000))]],
          [0.6, [hold({ pose: 'groom' }, rr(7000, 10000))]], [0.85, wander()], [1, [hold({ pose: 'loaf' }, rr(9000, 14000))]]]);
      default: // night
        if (Cat.time < Cat.awakeUntil) return awakeNight();
        return [goto_(P.bed.x, P.bed.y), hold({ pose: 'curl' }, Infinity)];
    }
  }

  Cat.run = function (steps, busy) { Cat.steps = steps.slice(); Cat.step = null; Cat.busy = !!busy; Cat.lift = 0; };
  Cat.interrupt = function () { if (!Cat.busy) { Cat.steps = []; Cat.step = null; Cat.lift = 0; } };
  // put him straight into the pose of the current phase's main activity (title screen / first frame)
  Cat.reset = function (phase, hour) {
    Cat.phase = phase; Cat.hour = hour; Cat.busy = false; Cat.ov = null; Cat.awakeUntil = 0;
    var sp = R.beamSpot(hour), plan;
    if (R.scene() === 'garden') { // first frame in the garden (?garden=1)
      if (phase === 'night') { Cat.x = P.gsleep.x; Cat.y = P.gsleep.y; plan = [hold({ pose: 'curl' }, Infinity)]; }
      else if (phase === 'day' || phase === 'morning') { Cat.x = P.hose.x; Cat.y = P.hose.y; plan = [hold({ pose: 'lieSide' }, rr(15000, 25000))]; }
      else { Cat.x = P.pot.x; Cat.y = P.pot.y; plan = [hold({ pose: 'sit', look: 1 }, 12000)]; }
      Cat.run(plan); return;
    }
    if (phase === 'morning') { Cat.x = sp.x; Cat.y = sp.y; plan = [hold({ pose: 'lieSide', say: 'sun' }, rr(15000, 25000))]; }
    else if (phase === 'day') { Cat.x = P.fan.x; Cat.y = P.fan.y; plan = [hold({ pose: 'lieSide', expr: 'open', say: 'fan' }, rr(14000, 25000))]; }
    else if (phase === 'night') { Cat.x = P.bed.x; Cat.y = P.bed.y; plan = [hold({ pose: 'curl' }, Infinity)]; }
    else if (phase === 'evening') { Cat.x = P.center.x; Cat.y = P.center.y; plan = [hold({ pose: 'sit', look: 1 }, 12000)]; }
    else { Cat.x = 82; Cat.y = 142; plan = [hold({ pose: 'sit' }, 12000)]; }
    Cat.run(plan);
  };
  // after the scene changed: back onto this scene's floor and off its props, then pick a fitting activity
  Cat.fit = function () { var p = Cat.avoid(Cat.x, Cat.y); Cat.x = p.x; Cat.y = p.y; Cat.interrupt(); };
  Cat.setPhase = function (phase, hour) { Cat.hour = hour; if (phase !== Cat.phase) { Cat.phase = phase; Cat.interrupt(); } };

  function begin(s) {
    Cat.step = s; Cat.st = 0;
    if (s.t === 'call') { s.fn(); Cat.step = null; return; }
    if (s.t === 'goto') { Cat.sx = Cat.x; Cat.sy = Cat.y; if (Math.abs(s.x - Cat.x) + Math.abs(s.y - Cat.y) < 1.5) Cat.step = null; }
    if (s.t === 'leap') { Cat.sx = Cat.x; Cat.sy = Cat.y; if (s.x > Cat.x + 1) Cat.dir = 1; else if (s.x < Cat.x - 1) Cat.dir = -1; }
    if (s.t === 'hold') { if (s.dir) Cat.dir = s.dir; if (s.say && Cat.onBubble && Math.random() < 0.7) Cat.onBubble(s.say); }
  }

  Cat.update = function (dt) {
    Cat.time += dt;
    var t = Cat.time, s;
    if (Cat.ov && t > Cat.ov.until) Cat.ov = null;
    if (Cat.petT > 0) Cat.petT -= dt;
    if (!Cat.step) {
      if (!Cat.steps.length) { Cat.busy = false; Cat.steps = actFor(Cat.phase, Cat.hour); }
      begin(Cat.steps.shift());
      return;
    }
    s = Cat.step; Cat.st += dt * 1000;
    if (s.t === 'goto') {
      var dx = s.x - Cat.x, dy = s.y - Cat.y, d = Math.sqrt(dx * dx + dy * dy), sp = (s.speed || 15) * dt;
      if (Math.abs(dx) > 0.6) Cat.dir = dx > 0 ? 1 : -1;
      if (d <= sp) { Cat.x = s.x; Cat.y = s.y; Cat.step = null; } else { Cat.x += dx / d * sp; Cat.y += dy / d * sp; }
    } else if (s.t === 'leap') {
      var u = Math.min(1, Cat.st / s.ms);
      Cat.x = Cat.sx + (s.x - Cat.sx) * u; Cat.y = Cat.sy + (s.y - Cat.sy) * u; Cat.lift = Math.sin(u * Math.PI) * (s.h || 10);
      if (u >= 1) { Cat.lift = 0; Cat.step = null; }
    } else if (s.t === 'hold') {
      if (s.tick) s.tick(dt);
      if (Cat.st >= s.ms) Cat.step = null;
    }
    // life accents
    if (t > Cat.nextBlink) { Cat.blinkUntil = t + 0.13; Cat.nextBlink = t + rr(2.5, 6); }
    if (t > Cat.nextEar) { Cat.earUntil = t + 0.28; Cat.nextEar = t + rr(6, 12); }
    if (t > Cat.nextTw) { Cat.twUntil = t + 0.4; Cat.nextTw = t + rr(3, 8); }
    if (t > Cat.nextDrowsy) { Cat.drowsyUntil = t + 3.5; Cat.nextDrowsy = t + rr(40, 80); }
    if (t > Cat.nextPaw) { Cat.pawUntil = t + 0.3; Cat.nextPaw = t + rr(4, 9); }
    if (Cat.pose() === 'curl' && t > Cat.nextZ) { Cat.nextZ = t + 1.8; var r = Cat.rects(); Fx.zzz(r.head.x + r.head.w - 6, r.head.y - 2); }
  };

  Cat.pose = function () { return (Cat.ov && Cat.ov.pose) || (Cat.step && Cat.step.t === 'hold' ? Cat.step.pose : (Cat.step && Cat.step.t === 'leap' ? 'leap' : (Cat.step && Cat.step.t === 'goto' ? 'walk' : 'sit'))); };
  Cat.isAsleep = function () { return Cat.pose() === 'curl'; };
  Cat.isWalking = function () { return !!(Cat.step && Cat.step.t === 'goto'); };

  // temporary reaction layered on whatever he is doing (greeting, hugging a hand, …)
  Cat.react = function (o, secs) { o.until = Cat.time + secs; Cat.ov = o; };
  Cat.petting = function () { Cat.petT = 0.5; };
  Cat.slowBlink = function () { Cat.slowUntil = Cat.time + 0.8; };
  Cat.earFlick = function () { Cat.earUntil = Cat.time + 0.4; };

  // touching while asleep: 5 touches within 10 s wakes him (stretch + yawn), awake for ~90 s
  Cat.poke = function () {
    var t = Cat.time; Cat.wakeAt.push(t); Cat.wakeAt = Cat.wakeAt.filter(function (a) { return t - a < 10; });
    Cat.earFlick();
    if (Cat.wakeAt.length >= 5) { Cat.wakeAt = []; Cat.wake(); return true; }
    return false;
  };
  Cat.wake = function () {
    Cat.awakeUntil = Cat.time + 90; Cat.busy = false;
    Cat.run([hold({ pose: 'stretch' }, 2600), hold({ pose: 'sit' }, 6000)]);
  };
  Cat.holdNow = function (pose, ms, extra) { var s = hold(extra || {}, ms); s.pose = pose; Cat.run([s], false); };

  /* ---------- sprite spec ---------- */
  Cat.spec = function () {
    var t = Cat.time, pose = Cat.pose(), s = Cat.step, ov = Cat.ov || {}, expr, sp;
    var hs = s && s.t === 'hold' ? s : {};
    expr = ov.expr || hs.expr || BASE[pose] || 'half';
    if (Cat.petT > 0 && pose !== 'curl' && !ov.expr) expr = (pose === 'eat' || pose === 'inBox') ? expr : 'happy';
    if (expr === 'open' && (pose === 'sit' || pose === 'loaf') && t < Cat.drowsyUntil && !Cat.busy) expr = 'drowsy'; // rare sleepy idle look
    if (expr === 'open' || expr === 'drowsy') {
      var sl = Cat.slowUntil - t; // slow blink: lids sink, close, rise
      if (sl > 0) expr = (sl > 0.55 || sl < 0.15) ? 'drowsy' : 'blink'; else if (t < Cat.blinkUntil) expr = 'blink';
    }
    sp = { pose: pose, expr: expr, br: Math.floor(t / (pose === 'curl' ? 1.7 : 1.2)) % 2, tw: t < Cat.twUntil ? 1 : 0, ear: t < Cat.earUntil ? 1 : 0, acc: Cat.acc };
    if (pose === 'walk') sp.f = Math.floor(t * 7) % 4;
    if (pose === 'eat') { sp.chew = Math.floor(t * 4) % 2; sp.mo = sp.chew; }
    if (pose === 'crouch') sp.rump = Math.floor(t * 8) % 2 ? 1 : -1;
    if (pose === 'groom' || pose === 'bat') sp.f = Math.floor(t * 2.2) % 2;
    if (pose === 'bellyUp') { sp.wg = Math.floor(t * 1.4) % 2; sp.hug = ov.hug ? 1 : 0; if (Cat.petT > 0) sp.expr = 'happy'; }
    if (pose === 'lieSide') sp.pt = t < Cat.pawUntil ? 1 : 0;
    if (pose === 'inBox') sp.vis = hs.vis || 12;
    if (pose === 'stretch') sp.expr = hs.expr || 'meow';
    return sp;
  };

  Cat.sprite = function () { return SP.get(Cat.spec()); };
  Cat.flipped = function () { return !!FLIP[Cat.pose()] && Cat.dir < 0; };
  function worldRect(m, r, fl) {
    var x = fl ? Cat.x + (m.ax - (r.x + r.w)) : Cat.x - m.ax + r.x;
    return { x: x, y: Cat.y - m.ay + r.y - Cat.lift, w: r.w, h: r.h };
  }
  Cat.rects = function () {
    var m = Cat.sprite(), fl = Cat.flipped();
    var body = worldRect(m, { x: 0, y: 0, w: m.w, h: m.h }, fl), head = worldRect(m, m.head, fl);
    var chin = { x: head.x + 3, y: head.y + head.h * 0.6, w: head.w - 6, h: head.h * 0.4 + 2 };
    return { body: body, head: head, chin: chin, belly: m.belly ? worldRect(m, m.belly, fl) : null };
  };
  function inR(r, x, y, pad) { return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }
  Cat.hit = function (vx, vy) {
    var r = Cat.rects(), pad = 3;
    if (!inR(r.body, vx, vy, pad)) return null;
    if (r.belly && inR(r.belly, vx, vy, 0) && Cat.pose() === 'bellyUp') return 'belly';
    if (inR(r.chin, vx, vy, 1)) return 'chin';
    if (inR(r.head, vx, vy, pad)) return 'head';
    return 'body';
  };
  Cat.headTop = function () { var r = Cat.rects(); return { x: r.head.x + r.head.w / 2, y: r.head.y }; };

  Cat.draw = function (ctx) {
    var m = Cat.sprite(), pose = Cat.pose(), fl = Cat.flipped();
    if (SHADOW[pose]) R.shadow(ctx, Cat.x, Cat.y, SHADOW[pose]);
    var top = Math.round(Cat.y - m.ay - Cat.lift);
    if (fl) { ctx.save(); ctx.translate(Math.round(Cat.x), 0); ctx.scale(-1, 1); ctx.drawImage(m.cv, -m.ax, top); ctx.restore(); }
    else ctx.drawImage(m.cv, Math.round(Cat.x - m.ax), top);
  };
  root.SomCat = Cat;
})(window);
