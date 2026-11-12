/* state.js - pure game logic (no DOM). Works in browser (window.SomState) and Node (module.exports). */
(function (root) {
  'use strict';

  var ITEMS = [
    { id: 'crown',   slot: 'head', name: 'มงกุฎราชา' },
    { id: 'sticker', slot: 'head', name: 'สติกเกอร์หน้าผาก' }
  ];
  var TREATS = [
    { id: 'rice',    name: 'ข้าวเม็ด',     say: 'ง่ำๆ อร่อย!' },
    { id: 'fish',    name: 'ปลาทู',        say: 'ปลาทูของโปรด!' },
    { id: 'chicken', name: 'ไก่ต้ม',       say: 'ไก่ต้มหอมจัง' },
    { id: 'lick',    name: 'ขนมแมวเลีย',   say: 'ขนมแมวเลีย!!!' }
  ];
    var FULL_AT = 3;
  var DECAY_MS = 10 * 60 * 1000;
    var SAVE_KEY = 'somhouse.v1';

  var THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thaiDate(d, long) {
    return d.getDate() + ' ' + (long ? THAI_MONTHS : THAI_MONTHS_SHORT)[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }
  function localDayNumber(d) { return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
  function memoryIndex(d, len) { return len > 0 ? localDayNumber(d) % len : -1; }

  // dawn 06, morning 07-10, day 11-16, evening 17-18, night 19-05
  function phaseFor(hour) {
    if (hour >= 6 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'day';
    if (hour >= 17 && hour < 19) return 'evening';
    return 'night';
  }

  function num(v, def, min) {
    v = Number(v);
    if (!isFinite(v)) return def;
    return v < min ? min : Math.floor(v);
  }
  function str(v, def, max) { return typeof v === 'string' ? v.slice(0, max) : def; }

  function defaults(now) {
    var t = now || Date.now();
    return {
      v: 1, name: '', createdAt: t, lastSeen: t, hearts: 0, petsTotal: 0, treatsTotal: 0,
      fullness: { n: 0, at: t }, equipped: { head: null },
      motd: { date: '' }, messages: [], bestCatch: 0, hints: { pet: false, slowblink: false }, sound: true
    };
  }

  // Accept anything; always return a valid state. Never throws.
  function repair(raw, now) {
    var d = defaults(now), o = (raw && typeof raw === 'object') ? raw : {};
    try {
      d.name = str(o.name, '', 16);
      d.createdAt = num(o.createdAt, d.createdAt, 0);
      d.lastSeen = num(o.lastSeen, d.lastSeen, 0);
      d.hearts = num(o.hearts, 0, 0);
      d.petsTotal = num(o.petsTotal, 0, 0);
      d.treatsTotal = num(o.treatsTotal, 0, 0);
      if (o.fullness && typeof o.fullness === 'object') {
        d.fullness = { n: Math.min(FULL_AT, num(o.fullness.n, 0, 0)), at: num(o.fullness.at, d.fullness.at, 0) };
      }
      if (o.equipped && typeof o.equipped === 'object') {
        var it = ITEMS.filter(function (i) { return i.id === o.equipped.head && i.slot === 'head'; })[0];
        d.equipped.head = it ? it.id : null;
      }
      if (o.motd && typeof o.motd === 'object') d.motd.date = str(o.motd.date, '', 10);
      if (Array.isArray(o.messages)) {
        d.messages = o.messages.filter(function (m) { return m && typeof m.text === 'string'; })
          .slice(0, 500).map(function (m) {
            return { id: str(m.id, String(Math.random()).slice(2), 24), name: str(m.name, '', 16), text: m.text.slice(0, 600), at: num(m.at, 0, 0) };
          });
      }
      d.bestCatch = num(o.bestCatch, 0, 0);
      if (o.hints && typeof o.hints === 'object') { d.hints.pet = o.hints.pet === true; d.hints.slowblink = o.hints.slowblink === true; }
      d.sound = o.sound !== false;
    } catch (e) { return defaults(now); }
    return d;
  }

  function parse(json, now) {
    var o = null;
    try { o = JSON.parse(json); } catch (e) { o = null; }
    return repair(o, now);
  }

  function addHearts(s, n) { s.hearts += Math.max(0, Math.floor(n)); }
  // one head item at a time; tapping the worn item removes it
  function equip(s, id) {
    var it = ITEMS.filter(function (i) { return i.id === id; })[0];
    if (!it) return false;
    s.equipped[it.slot] = s.equipped[it.slot] === id ? null : id;
    return true;
  }

  // Fullness: +1 per treat, decays 1 per 10 minutes, never negative.
  function fullnessNow(s, now) {
    var f = s.fullness;
    return Math.max(0, f.n - Math.floor(Math.max(0, now - f.at) / DECAY_MS));
  }
  function isFull(s, now) { return fullnessNow(s, now) >= FULL_AT; }
  function feed(s, now) {
    var cur = fullnessNow(s, now);
    if (cur >= FULL_AT) return { ok: false, fullness: cur, nowFull: true };
    s.fullness = { n: cur + 1, at: now };
    s.treatsTotal += 1;
    return { ok: true, fullness: cur + 1, nowFull: cur + 1 >= FULL_AT };
  }

  // messages to ส้ม (stored oldest first; the UI shows newest first)
  function addMessage(s, name, text, now) {
    text = String(text == null ? '' : text).trim();
    if (!text) return null;
    var m = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), name: String(name || '').slice(0, 16), text: text.slice(0, 600), at: now };
    s.messages.push(m);
    if (s.messages.length > 500) s.messages.shift();
    return m;
  }
  function deleteMessage(s, id) {
    var n = s.messages.length;
    s.messages = s.messages.filter(function (m) { return m.id !== id; });
    return s.messages.length < n;
  }
  // stable tiny-star position inside the window glass (x 11..47, y 11..41), never on top of ดาวส้ม (x 33..43, y 16..28)
  function starPos(id) {
    var h = 2166136261, i;
    for (i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var x = 11 + (h % 37), y = 11 + (Math.floor(h / 37) % 31);
    if (x >= 32 && x <= 44 && y >= 15 && y <= 29) y = y < 22 ? 31 + (x % 8) : 31 + (x % 8);
    return { x: x, y: y };
  }

  function needMotd(s, now) { return s.motd.date !== dateKey(new Date(now)); }
  function markMotd(s, now) { s.motd.date = dateKey(new Date(now)); }

  var api = {
    ITEMS: ITEMS, TREATS: TREATS, FULL_AT: FULL_AT, DECAY_MS: DECAY_MS, SAVE_KEY: SAVE_KEY,
    dateKey: dateKey, thaiDate: thaiDate, localDayNumber: localDayNumber, memoryIndex: memoryIndex, phaseFor: phaseFor,
    defaults: defaults, repair: repair, parse: parse, addHearts: addHearts, equip: equip,
    fullnessNow: fullnessNow, isFull: isFull, feed: feed, needMotd: needMotd, markMotd: markMotd,
    addMessage: addMessage, deleteMessage: deleteMessage, starPos: starPos
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SomState = api;
})(typeof window !== 'undefined' ? window : this);
