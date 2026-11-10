/* ui.js - small DOM helpers: element builder, bottom sheet, speech bubble, caption. All text is real HTML for crisp Thai. */
(function (root) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function icon(name, scale, cls) { var i = el('img', cls || 'ic', null, { alt: '', draggable: 'false' }); i.src = root.SomIcons.url(name, scale); return i; }

  var scale = 1, vpW = 360, bub = null, bubT = 0, anchor = null, capT = 0, onClose = null;

  var UI = {
    el: el, icon: icon, $: $,
    setScale: function (k, w) { scale = k; vpW = w; },
    openSheet: function (title, body, close) {
      $('sheetTitle').textContent = title; var b = $('sheetBody'); b.textContent = ''; b.appendChild(body);
      $('scrim').hidden = false; $('sheet').hidden = false; onClose = close || null;
      requestAnimationFrame(function () { $('sheet').classList.add('open'); });
    },
    closeSheet: function () {
      var s = $('sheet'); s.classList.remove('open'); s.hidden = true; $('scrim').hidden = true;
      if (onClose) { var f = onClose; onClose = null; f(); }
    },
    sheetOpen: function () { return !$('sheet').hidden; },
    // bubble follows anchor() -> {x,y} in virtual coords
    say: function (text, anchorFn, ms) {
      UI.hideBubble();
      bub = el('div', 'bubble', text); $('bubbles').appendChild(bub); anchor = anchorFn;
      bubT = setTimeout(UI.hideBubble, ms || 1900); UI.place();
    },
    hideBubble: function () { clearTimeout(bubT); if (bub && bub.parentNode) bub.parentNode.removeChild(bub); bub = null; },
    place: function () {
      if (!bub || !anchor) return;
      var p = anchor(), w = bub.offsetWidth, x = p.x * scale, minX = w / 2 + 4, maxX = vpW - w / 2 - 4;
      x = Math.max(minX, Math.min(maxX, x));
      bub.style.left = x + 'px'; bub.style.top = Math.max(bub.offsetHeight + 6, p.y * scale - 8) + 'px';
      bub.style.setProperty('--tail', (p.x * scale - x) + 'px');
    },
    caption: function (text, ms) {
      var c = $('caption'); c.textContent = text; c.hidden = false; clearTimeout(capT);
      capT = setTimeout(function () { c.hidden = true; }, ms || 4500);
    }
  };
  root.SomUI = UI;
})(window);
