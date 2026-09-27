// Access gate for the encrypted build (see tools/build_site.py).
// Login page: derives a key from username + password, unwraps the site key
// and replaces the page with the decrypted content. Content pages: resolves
// encrypted images/PDFs with the site key kept in sessionStorage.
(function(){
  'use strict';

  var STORE = 'bv-access';
  var AUTH_URL = 'auth.json';
  var enc = new TextEncoder();

  function fromB64(s){
    var bin = atob(s), out = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(bytes){
    var s = '';
    for(var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function toHex(buf){
    return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function loadRaw(){
    try { var v = sessionStorage.getItem(STORE); return v ? fromB64(v) : null; } catch(e){ return null; }
  }
  function saveRaw(raw){ try { sessionStorage.setItem(STORE, toB64(raw)); } catch(e){} }
  function clearRaw(){ try { sessionStorage.removeItem(STORE); } catch(e){} }

  function importSiteKey(raw){
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  }
  // Blob layout: 12-byte IV followed by ciphertext + GCM tag.
  function decryptBlob(key, bytes){
    return crypto.subtle.decrypt({ name:'AES-GCM', iv:bytes.slice(0, 12) }, key, bytes.slice(12));
  }

  var payload = document.getElementById('bv-payload');
  if(payload) gate(); else content();

  function gate(){
    var root = document.documentElement;
    var form = document.getElementById('bv-login');
    var btn = form.querySelector('button[type=submit]');
    var btnLabel = btn.querySelector('span');
    var err = document.getElementById('bv-error');

    function showForm(){ root.classList.remove('gate-auto'); }
    function showError(msg){ err.textContent = msg; err.hidden = false; }

    async function openPage(raw){
      var key = await importSiteKey(raw);
      var plain = await decryptBlob(key, fromB64(payload.textContent.trim()));
      saveRaw(raw);
      var html = new TextDecoder().decode(plain);
      // document.open() while this page is still loading would leave the load pending forever.
      if(document.readyState !== 'complete'){
        await new Promise(function(r){ window.addEventListener('load', r, { once:true }); });
      }
      document.open();
      document.write(html);
      document.close();
    }

    if(!window.crypto || !crypto.subtle){
      showForm();
      showError('Ihr Browser unterstützt die sichere Anmeldung nicht. Bitte verwenden Sie einen aktuellen Browser.');
      btn.disabled = true;
      return;
    }

    var stored = loadRaw();
    if(stored){
      openPage(stored).catch(function(){ clearRaw(); showForm(); });
    }

    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      var user = form.elements.user.value.trim().toLowerCase();
      var pass = form.elements.pass.value;
      if(!user || !pass) return;

      err.hidden = true;
      btn.disabled = true;
      btnLabel.textContent = 'Wird geprüft …';
      try {
        var res = await fetch(AUTH_URL, { cache:'no-store' });
        var auth = await res.json();
        var id = toHex(await crypto.subtle.digest('SHA-256', enc.encode(auth.ns + '|' + user)));
        var entry = auth.users[id];
        if(!entry) throw new Error('unknown');

        var base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
        var kek = await crypto.subtle.deriveKey(
          { name:'PBKDF2', salt:fromB64(entry.s), iterations:auth.iterations, hash:'SHA-256' },
          base, { name:'AES-GCM', length:256 }, false, ['decrypt']
        );
        var raw = new Uint8Array(await crypto.subtle.decrypt(
          { name:'AES-GCM', iv:fromB64(entry.i), additionalData:enc.encode(id) }, kek, fromB64(entry.k)
        ));
        await openPage(raw);
      } catch(e){
        showError('Benutzername oder Passwort ist nicht korrekt.');
        form.elements.pass.value = '';
        form.elements.pass.focus();
        btn.disabled = false;
        btnLabel.textContent = 'Anmelden';
      }
    });
  }

  function content(){
    var raw = loadRaw();
    if(!raw) return;
    var keyP = importSiteKey(raw);

    async function fetchPlain(url){
      var res = await fetch(url);
      if(!res.ok) throw new Error('fetch');
      return decryptBlob(await keyP, new Uint8Array(await res.arrayBuffer()));
    }

    document.querySelectorAll('img[data-protected-src]').forEach(function(img){
      fetchPlain(img.getAttribute('data-protected-src')).then(function(plain){
        img.src = URL.createObjectURL(new Blob([plain], { type:img.getAttribute('data-mime') }));
      }).catch(function(){});
    });

    document.querySelectorAll('a[data-protected-href]').forEach(function(a){
      a.addEventListener('click', async function(ev){
        ev.preventDefault();
        var isDownload = a.hasAttribute('download');
        // Open the tab synchronously so popup blockers accept it.
        var win = isDownload ? null : window.open('', '_blank');
        if(win) win.document.write('<title>Wird geladen …</title><body style="background:#0B0D10;color:#9aa3ad;font-family:sans-serif;padding:24px">Wird geladen …</body>');
        try {
          var plain = await fetchPlain(a.getAttribute('data-protected-href'));
          var url = URL.createObjectURL(new Blob([plain], { type:a.getAttribute('data-mime') }));
          if(isDownload){
            var tmp = document.createElement('a');
            tmp.href = url;
            tmp.download = a.getAttribute('data-name');
            document.body.appendChild(tmp);
            tmp.click();
            tmp.remove();
          } else if(win){
            win.location.href = url;
          } else {
            location.href = url;
          }
        } catch(e){
          if(win) win.close();
          alert('Die Datei konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
        }
      });
    });

    var footerLinks = document.querySelector('.site-footer p');
    if(footerLinks){
      var out = document.createElement('a');
      out.href = '#';
      out.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Abmelden';
      out.addEventListener('click', function(ev){ ev.preventDefault(); clearRaw(); location.reload(); });
      footerLinks.appendChild(document.createTextNode(' · '));
      footerLinks.appendChild(out);
    }

    if(location.hash){
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if(target) setTimeout(function(){ target.scrollIntoView(); }, 50);
    }
  }
})();
