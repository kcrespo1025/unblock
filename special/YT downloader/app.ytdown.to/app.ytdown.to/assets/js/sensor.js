(function () {
  var s = document.querySelector('script[data-ch]');
  var ch = (s && s.getAttribute('data-ch')) || '';
  var SK = (s && s.getAttribute('data-sk')) || '';
  if (!ch) return;
  var MINT = '/mint.php';
  var H = { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' };
  var K = 'a7f3c9e1b45d8206e93af17c0d6b8e42', enc = new TextEncoder();
  var loading = false, res = null, rej = null, to = null;

  function clearP() { res = rej = null; if (to) { clearTimeout(to); to = null; } window.__reminting = null; }
  function setDt(dt) {
    window.__d = dt;
    var w = document.getElementById('__tsw'); if (w && w.parentNode) w.parentNode.removeChild(w);
    if (res) { var f = res; clearP(); f(dt); }
  }
  function failP(kind) { if (rej) { var f = rej; clearP(); f({ kind: kind }); } else { window.__reminting = null; } }

  function viaToken(t) {
    fetch(MINT, { method: 'POST', headers: H, body: 'ts=' + encodeURIComponent(t) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.dt) setDt(j.dt); })
      .catch(function () {});
  }
  function show(k, cd) {
    k = k || SK; if (!k || document.getElementById('__tsw')) return;
    var o = document.createElement('div'); o.id = '__tsw';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    var b = document.createElement('div');
    b.style.cssText = 'background:#fff;padding:22px 20px;border-radius:12px;max-width:340px;text-align:center;font-family:system-ui,-apple-system,sans-serif';
    b.innerHTML = '<div style="font-size:15px;color:#222;margin-bottom:14px">Please verify to continue.</div><div id="__tsb"></div>';
    o.appendChild(b); document.body.appendChild(o);
    var opts = { sitekey: k, callback: viaToken }; if (cd) opts.cData = cd;
    try { window.turnstile.render('#__tsb', opts); } catch (e) {}
  }
  function _load(k, cd) {
    if (window.turnstile && window.turnstile.render) { show(k, cd); return; }
    if (loading) { show(k, cd); return; }
    loading = true;
    var t = setTimeout(function () { failP('turnstile'); }, 8000);
    var js = document.createElement('script');
    js.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; js.async = true;
    js.onerror = function () { clearTimeout(t); failP('turnstile'); };
    js.onload = function () { clearTimeout(t); show(k, cd); };
    document.head.appendChild(js);
  }
  function tsRender(k) {
    fetch(MINT, { method: 'POST', headers: H, body: 'tn=1' })
      .then(function (r) { return r.json(); })
      .then(function (j) { _load(k, (j && j.tn) || ''); })
      .catch(function () { _load(k, ''); });
  }
  function answer(cc) {
    return crypto.subtle.importKey('raw', enc.encode(K), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (kk) { return crypto.subtle.sign('HMAC', kk, enc.encode(cc)); })
      .then(function (g) { return Array.from(new Uint8Array(g)).map(function (bb) { return bb.toString(16).padStart(2, '0'); }).join('').slice(0, 32); });
  }
  function crypMint(cc) {
    return answer(cc).then(function (a) {
      return fetch(MINT, { method: 'POST', headers: H, body: 'ch=' + encodeURIComponent(cc) + '&answer=' + a })
        .then(function (r) { if (r.status === 403) { tsRender(SK); return null; } return r.json(); })
        .then(function (j) {
          if (!j) return;
          if (j.dt) { setDt(j.dt); return; }
          if (j.needTurnstile) { tsRender(j.sitekey); return; }
        });
    });
  }

  if (!window.crypto || !crypto.subtle) {
    try { fetch(MINT, { method: 'POST', headers: H, body: 'nc=1' }); } catch (e) {}
  } else {
    crypMint(ch).catch(function () {});
  }

  window.__remint = function () {
    if (window.__reminting) return window.__reminting;
    window.__reminting = new Promise(function (resolve, reject) {
      res = resolve; rej = reject;
      to = setTimeout(function () { failP('transport'); }, 20000);
      if (!window.crypto || !crypto.subtle) { tsRender(SK); return; }
      fetch(MINT, { method: 'POST', headers: H, body: 'getch=1' })
        .then(function (r) { return r.json(); })
        .then(function (g) { if (!g || !g.ch) { failP('transport'); return; } return crypMint(g.ch); })
        .catch(function () { failP('transport'); });
    });
    return window.__reminting;
  };
})();
