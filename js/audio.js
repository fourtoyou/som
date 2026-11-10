/* audio.js - WebAudio synth only. No files, no network. Safe when AudioContext is missing. */
(function (root) {
  'use strict';
  var ctx = null, master = null, enabled = true, purrG = null, purrOn = false, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') try { ctx.resume(); } catch (e) {} return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = enabled ? 0.35 : 0; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  function ok() { return ctx && enabled; }
  function setEnabled(v) {
    enabled = !!v; if (master) master.gain.setTargetAtTime(enabled ? 0.35 : 0, ctx.currentTime, 0.05);
    if (!enabled) purr(false);
  }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!ok()) return; var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, freq, vol, delay, type) {
    if (!ok()) return; var t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  var purrNodes = null;
  function purr(on) {
    if (!ctx) return;
    if (on && !purrNodes && enabled) {
      var s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), amp = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), out = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 2;
      amp.gain.value = 0.5; lfo.frequency.value = 24; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(amp.gain);
      out.gain.value = 0.0001; out.gain.setTargetAtTime(1.6, ctx.currentTime, 0.25);
      s.connect(lp); lp.connect(amp); amp.connect(out); out.connect(master); s.start(); lfo.start();
      purrNodes = { s: s, lfo: lfo, out: out };
    } else if (!on && purrNodes) {
      var n = purrNodes; purrNodes = null; n.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
      setTimeout(function () { try { n.s.stop(); n.lfo.stop(); } catch (e) {} }, 900);
    }
  }
  // No synthesized voice. If audio/meow.mp3 is ever added it plays; if missing it stays silent (tried once, no retry spam).
  var HAS_MEOW = false; // flip to true only when audio/meow.mp3 is added; keeps the site from requesting a missing file
  var meowEl = null, meowBad = false;
  function meow() {
    if (!HAS_MEOW || !enabled || meowBad) return;
    try {
      if (!meowEl) {
        meowEl = new Audio(); meowEl.preload = 'none'; meowEl.preservesPitch = false; meowEl.volume = 0.8;
        meowEl.addEventListener('error', function () { meowBad = true; });
        meowEl.src = 'audio/meow.mp3';
      }
      meowEl.playbackRate = 0.94 + Math.random() * 0.12; meowEl.currentTime = 0;
      var p = meowEl.play(); if (p && p.catch) p.catch(function () { meowBad = true; });
    } catch (e) { meowBad = true; }
  }
  root.SomAudio = {
    init: init, setEnabled: setEnabled, isEnabled: function () { return enabled; }, purr: purr, meow: meow,
    crunch: function () { for (var i = 0; i < 3; i++) noiseBurst(0.07, 1600, 0.5, i * 0.16); },
    pop: function () { tone('sine', 520, 900, 0.06, 0.25); },
    blip: function () { tone('square', 660, 660, 0.05, 0.08); },
    sparkle: function () { [880, 1175, 1568].forEach(function (f, i) { tone('sine', f, f * 1.01, 0.16, 0.15, i * 0.07); }); },
    bell: function () { tone('sine', 1900, 1880, 0.25, 0.1); tone('sine', 2850, 2800, 0.2, 0.05); }
  };
})(window);
