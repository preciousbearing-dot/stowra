/* The Stowing sheet logic. The share is already saved by Android before this page runs, so nothing here can lose it. */
(function () {
  'use strict';
  var N = window.StowraNative;
  var share = {};
  try { share = JSON.parse(N.getShare()); } catch (e) { share = {}; }
  try {
    var t = JSON.parse(N.getTheme());
    Object.keys(t).forEach(function (k) { if (k !== 'scheme') document.documentElement.style.setProperty('--' + k, t[k]); });
    document.documentElement.style.setProperty('--glass', t.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(21,20,18,0.04)');
  } catch (e) { /* defaults stay */ }

  var PKG = { 'com.zhiliaoapp.musically': 'TikTok', 'com.ss.android.ugc.trill': 'TikTok', 'com.google.android.youtube': 'YouTube', 'com.instagram.android': 'Instagram', 'com.twitter.android': 'X', 'com.android.chrome': 'Chrome', 'org.mozilla.firefox': 'Firefox', 'com.reddit.frontpage': 'Reddit', 'com.facebook.katana': 'Facebook', 'com.whatsapp': 'WhatsApp' };
  var VIDEO = /(^|\.)(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|vimeo\.com|facebook\.com|fb\.watch|x\.com|twitter\.com)$/i;
  var url = (String(share.text || '').match(/https?:\/\/[^\s]+/) || [''])[0];
  var host = '';
  try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch (e) { host = ''; }
  var files = share.files || [];
  var mime = String(share.mime || (files[0] && files[0].mime) || '');

  var source = PKG[share.source] || (host ? host : (files.length ? 'Your files' : 'Shared item'));
  document.getElementById('srcText').textContent = host || PKG[share.source] ? 'From ' + source : source;

  var noun = 'item';
  if (files.length) noun = /^image\//.test(mime) ? (files.length > 1 ? 'images' : 'image') : (/pdf/.test(mime) ? 'PDF' : 'file');
  else if (host && VIDEO.test(host)) noun = /youtu|tiktok|instagram|vimeo|fb\.watch/.test(host) ? 'video' : 'post';
  else if (url) noun = 'link';
  else if (share.text) noun = 'note';
  var verb = noun === 'images' ? 'are' : 'is';
  document.getElementById('doneText').textContent = 'Your ' + noun + ' ' + verb + ' safe in your Trove. Stowra will read it in the background.';

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function () { try { N.tick(); } catch (e) { /* no haptics */ } }, reduced ? 300 : 2350);
  setTimeout(function () { document.getElementById('actions').classList.add('live'); }, reduced ? 0 : 2800);

  var REASONS = ['To learn', 'To make something', 'To try a tool', 'For ideas', 'Just keep it'];
  var chips = document.getElementById('rchips');
  REASONS.forEach(function (label) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on');
      try { N.setReason(label); } catch (e) { /* the Keep is saved either way */ }
    });
    chips.appendChild(b);
  });
  document.getElementById('reason').addEventListener('click', function () {
    var r = document.getElementById('reasons');
    r.hidden = !r.hidden;
  });
  document.getElementById('open').addEventListener('click', function () { N.openApp(); });
  document.getElementById('close').addEventListener('click', function () { N.close(); });
  document.getElementById('scrim').addEventListener('click', function () { N.close(); });
})();
