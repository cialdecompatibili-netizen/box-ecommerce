/* E-COMMERCE (admin): prodotti e categorie del negozio. Doc: CLAUDE.md > punto "E-COMMERCE". Lato sito: _plugins/ecommerce.rb, _pages/negozio.md.
   PUNTI CRITICI
   1) FONTE UNICA = _data/catalogo.json ({_nota, categorie:[{id,nome,icona}], box:[{id,nome,descrizione,categoria,icona,tipo,prezzo_centesimi,intervallo,ogni,visibile}]}).
      La leggono /negozio/, le pagine prodotto (plugin), il Worker Cloudflare e questa vista: i nomi dei campi NON si cambiano senza cambiare tutti e quattro.
   2) L'id di un prodotto/categoria e' l'URL (/negozio/<id>/) e la chiave del carrello e degli ordini: dopo la creazione NON si cambia (campo bloccato). Solo a-z 0-9 e '-'
      (il plugin salta gli id diversi). Per "rinominare" si cambia il nome, non l'id.
   3) prezzo_centesimi = euro x 100 INTERO (Stripe lavora in centesimi). Qui si scrive in euro e si converte con toCents (virgola o punto).
   4) Gli abbonamenti nello stesso carrello devono avere lo stesso ritmo (regola Stripe, vedi _nota del catalogo): qui NON si controlla, resta nella _nota.
   5) deploy.yml NON parte per un push di soli .json: la riga "_data/catalogo.json" in .github/workflows/deploy.yml serve a questo. Se la togli, salvare qui non pubblica niente.
   6) Si rilegge SEMPRE il file prima di scrivere (sha fresco): un salvataggio da un'altra scheda non viene sovrascritto con dati vecchi (GitHub risponde 409 e si vede il messaggio).
   7) Scrittura: ser() mantiene il formato a una riga per voce e la _nota. Se nel catalogo compaiono chiavi nuove di primo livello vanno aggiunte in ser(), altrimenti si perdono.
   8) L'interruttore e-commerce NON sta qui: e' in Impostazioni (chiave ecommerce di _config.yml, admin-media.js). Qui si mostra solo l'avviso se e' spento. */
(function (A) {
  var $ = A.$, esc = A.esc, jq = A.jq, M = function () { return A.main(); };
  var PATH = '_data/catalogo.json', ID_RE = /^[a-z0-9-]+$/, fcat = '';

  function load() {
    return A.getFile(PATH).then(function (f) {
      var d;
      try { d = JSON.parse(f.text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error('Il catalogo non si legge (file _data/catalogo.json rovinato): controllalo su GitHub'); }
      if (!d || typeof d !== 'object') d = {};
      if (!Array.isArray(d.categorie)) d.categorie = [];
      if (!Array.isArray(d.box)) d.box = [];
      return { sha: f.sha, d: d };
    });
  }
  /* ser: stesso aspetto del file originale (una voce per riga), con _nota in testa. Niente BOM. */
  function ser(d) {
    var line = function (x) { return '  ' + JSON.stringify(x); };
    return '{\n "_nota": ' + JSON.stringify(d._nota || '') + ',\n "categorie": [\n' + d.categorie.map(line).join(',\n') + '\n ],\n "box": [\n' + d.box.map(line).join(',\n') + '\n ]\n}\n';
  }
  function save(c, msg) { return A.putFile(PATH, ser(c.d), c.sha, msg); }
  function euro(cent) { return (Math.round(+cent || 0) / 100).toFixed(2).replace('.', ','); }
  function toCents(s) { var n = parseFloat(String(s).trim().replace(',', '.')); if (!isFinite(n) || n <= 0 || n > 10000) return 0; return Math.round(n * 100); }
  function per(p) {
    if (p.tipo !== 'abbonamento') return '';
    var o = +p.ogni || 1, nm = { week: ['settimana', 'settimane'], year: ['anno', 'anni'] }[p.intervallo] || ['mese', 'mesi'];
    return o > 1 ? 'ogni ' + o + ' ' + nm[1] : '/ ' + nm[0];
  }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function fail(e) { A.toast(A.errMsg(e), true); }

  /* Avviso se l'e-commerce e' spento (chiave ecommerce di _config.yml: assente = spento, come nel plugin). */
  function banner() {
    return A.getFile('_config.yml').then(function (f) {
      var m = f.text.match(/^ecommerce:[ \t]*(\S+)/m);
      if (m && m[1].toLowerCase() === 'true') return '';
      return '<div class="card" style="border-color:#dba617;background:#fcf9e8"><b>E-commerce spento.</b> Il Negozio non si vede sul sito. Qui puoi preparare prodotti e categorie; per accenderlo vai in <a onclick="A.go(\'settings\')">Impostazioni</a> e spunta \u201cAbilita e-commerce\u201d.</div>';
    }, function () { return ''; });
  }

  /* ---------------- PRODOTTI ---------------- */
  A.views.ecom = function () {
    $('topTitle').textContent = 'Prodotti';
    return Promise.all([load(), banner()]).then(function (v) {
      var c = v[0].d, h = v[1] + '<h2>Prodotti</h2><div class="card"><div class="tools"><button class="btn primary" onclick="A.ecEdit(\'\')">+ Nuovo prodotto</button> ' +
        '<select id="ec_f" onchange="A.ecFilt(this.value)" style="width:auto;display:inline-block"><option value="">Tutte le categorie</option>' +
        c.categorie.map(function (k) { return '<option value="' + esc(k.id) + '"' + (fcat === k.id ? ' selected' : '') + '>' + esc((k.icona || '') + ' ' + k.nome) + '</option>'; }).join('') +
        '<option value="-"' + (fcat === '-' ? ' selected' : '') + '>Senza categoria</option></select></div><div class="list">';
      var n = 0;
      c.box.forEach(function (p) {
        var k = byId(c.categorie, p.categoria);
        if (fcat === '-' ? k : (fcat && p.categoria !== fcat)) return;
        n++;
        var hid = p.visibile === false;
        h += '<div class="it"><span>' + esc(p.icona || '') + ' <b' + (hid ? ' style="opacity:.55"' : '') + '>' + esc(p.nome) + '</b><small>' + esc(k ? k.nome : 'senza categoria') + ' \u00b7 ' +
          (p.tipo === 'abbonamento' ? 'abbonamento' : 'acquisto singolo') + ' \u00b7 ' + euro(p.prezzo_centesimi) + ' \u20ac ' + esc(per(p)) + '</small>' + (hid ? '<small class="ko">nascosto</small>' : '') + '</span>' +
          '<button class="btn sm" onclick="A.ecVis(\'' + jq(p.id) + '\')">' + (hid ? 'Mostra' : 'Nascondi') + '</button>' +
          '<button class="btn sm" onclick="A.ecEdit(\'' + jq(p.id) + '\')">Modifica</button>' +
          '<button class="btn sm danger" onclick="A.ecDel(\'' + jq(p.id) + '\')">Elimina</button></div>';
      });
      if (!n) h += '<p>Nessun prodotto' + (fcat ? ' in questa categoria' : '') + '. Premi \u201c+ Nuovo prodotto\u201d.</p>';
      M().innerHTML = h + '</div><small>Nascondere un prodotto lo toglie dal negozio e dal carrello, ma resta salvato. Dopo ogni modifica il sito si aggiorna in 2-3 minuti.</small></div>';
    });
  };
  A.ecFilt = function (v) { fcat = v; A.go('ecom'); };

  A.ecVis = A.wrap(function (id) {
    return load().then(function (c) {
      var p = byId(c.d.box, id); if (!p) throw new Error('Prodotto non trovato: ricarica la pagina');
      p.visibile = (p.visibile === false);
      return save(c, 'admin: e-commerce ' + (p.visibile ? 'mostra ' : 'nascondi ') + id).then(function () { A.toast(p.visibile ? 'Prodotto visibile' : 'Prodotto nascosto'); A.go('ecom'); });
    });
  });
  A.ecDel = A.wrap(function (id) {
    return load().then(function (c) {
      var p = byId(c.d.box, id); if (!p) throw new Error('Prodotto non trovato: ricarica la pagina');
      if (!confirm('Eliminare \u201c' + p.nome + '\u201d? Sparisce dal negozio. Se vuoi solo toglierlo dalla vendita usa Nascondi.')) return;
      c.d.box = c.d.box.filter(function (x) { return x.id !== id; });
      return save(c, 'admin: e-commerce elimina ' + id).then(function () { A.toast('Eliminato'); A.go('ecom'); });
    });
  });

  A.ecTipo = function () { var s = $('ec_tipo').value === 'abbonamento'; $('ec_ab').style.display = s ? '' : 'none'; };
  A.ecEdit = function (id) {
    load().then(function (c) {
      var p = id ? byId(c.d.box, id) : null; if (id && !p) throw new Error('Prodotto non trovato: ricarica la pagina');
      p = p || { tipo: 'abbonamento', intervallo: 'month', ogni: 1, visibile: true, icona: '\ud83d\udce6' };
      var opt = function (arr, cur) { return arr.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); };
      var cats = [['', 'Nessuna categoria']].concat(c.d.categorie.map(function (k) { return [k.id, (k.icona || '') + ' ' + k.nome]; }));
      $('topTitle').textContent = id ? 'Modifica prodotto' : 'Nuovo prodotto';
      M().innerHTML = '<h2>' + (id ? 'Modifica prodotto' : 'Nuovo prodotto') + '</h2><div class="card">' +
        '<label>Nome</label><input id="ec_nome" value="' + esc(p.nome || '') + '" placeholder="Es. Box Caff\u00e8 e T\u00e8">' +
        '<label>Indirizzo (si vede nell\u0027URL: /negozio/<i>indirizzo</i>/)</label><input id="ec_id" value="' + esc(p.id || '') + '"' + (id ? ' readonly style="background:#f0f0f1"' : ' placeholder="vuoto = lo ricavo dal nome"') + '>' +
        '<small>' + (id ? 'Non si pu\u00f2 cambiare dopo la creazione: \u00e8 la chiave del carrello e degli ordini.' : 'Solo lettere minuscole, numeri e trattini. Dopo il salvataggio non si cambia pi\u00f9.') + '</small>' +
        '<label>Descrizione breve</label><textarea id="ec_desc" style="min-height:70px;font-family:inherit">' + esc(p.descrizione || '') + '</textarea>' +
        '<div class="row"><div><label>Categoria</label><select id="ec_cat">' + opt(cats, p.categoria || '') + '</select></div>' +
        '<div><label>Icona (una emoji)</label><input id="ec_ico" value="' + esc(p.icona || '') + '" maxlength="4"></div></div>' +
        '<div class="row"><div><label>Come si vende</label><select id="ec_tipo" onchange="A.ecTipo()">' + opt([['abbonamento', 'Abbonamento (si rinnova da solo)'], ['singola', 'Acquisto singolo (pagamento unico)']], p.tipo) + '</select></div>' +
        '<div><label>Prezzo in euro</label><input id="ec_prezzo" value="' + (p.prezzo_centesimi ? euro(p.prezzo_centesimi) : '') + '" placeholder="Es. 29,90" inputmode="decimal"></div></div>' +
        '<div id="ec_ab" class="row" style="' + (p.tipo === 'abbonamento' ? '' : 'display:none') + '"><div><label>Si rinnova ogni</label><input id="ec_ogni" type="number" min="1" max="52" value="' + (+p.ogni || 1) + '"></div>' +
        '<div><label>Unit\u00e0</label><select id="ec_int">' + opt([['week', 'settimane'], ['month', 'mesi'], ['year', 'anni']], p.intervallo || 'month') + '</select></div></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ec_vis" style="width:auto"' + (p.visibile === false ? '' : ' checked') + '> Visibile nel negozio</label>' +
        '<p><button class="btn primary" onclick="A.ecSave(\'' + jq(id || '') + '\')">Salva</button> <button class="btn" onclick="A.go(\'ecom\')">Annulla</button></p></div>';
    }).catch(fail);
  };
  A.ecSave = A.wrap(function (old) {
    var nome = $('ec_nome').value.trim(), tipo = $('ec_tipo').value, cents = toCents($('ec_prezzo').value);
    if (!nome) return A.toast('Scrivi il nome del prodotto', true);
    if (!cents) return A.toast('Prezzo non valido: scrivi un importo in euro, es. 29,90', true);
    var id = old || A.slugify($('ec_id').value.trim() || nome);
    if (!ID_RE.test(id)) return A.toast('Indirizzo non valido: solo lettere minuscole, numeri e trattini', true);
    var ogni = Math.round(+$('ec_ogni').value) || 1; if (ogni < 1 || ogni > 52) return A.toast('Il rinnovo va da 1 a 52', true);
    return load().then(function (c) {
      var prev = byId(c.d.box, id);
      if (old && !prev) throw new Error('Prodotto non trovato: ricarica la pagina');
      if (!old && prev) throw new Error('Esiste gi\u00e0 un prodotto con questo indirizzo (' + id + '): cambialo');
      var n = { id: id, nome: nome, descrizione: $('ec_desc').value.trim(), categoria: $('ec_cat').value, icona: $('ec_ico').value.trim(), tipo: tipo, prezzo_centesimi: cents };
      if (tipo === 'abbonamento') { n.intervallo = $('ec_int').value; n.ogni = ogni; }
      n.visibile = $('ec_vis').checked;
      if (prev) for (var k in prev) if (!(k in n) && k !== 'intervallo' && k !== 'ogni') n[k] = prev[k]; // chiavi extra scritte a mano restano
      if (prev) c.d.box[c.d.box.indexOf(prev)] = n; else c.d.box.push(n);
      return save(c, 'admin: e-commerce ' + (prev ? 'modifica ' : 'nuovo ') + id).then(function () { A.toast('Salvato'); A.go('ecom'); });
    });
  });

  /* ---------------- CATEGORIE ---------------- */
  A.views.ecomcat = function () {
    $('topTitle').textContent = 'Categorie prodotti';
    return Promise.all([load(), banner()]).then(function (v) {
      var c = v[0].d, h = v[1] + '<h2>Categorie prodotti</h2><div class="card"><div class="tools"><button class="btn primary" onclick="A.ecCatEdit(\'\')">+ Nuova categoria</button></div><div class="list">';
      c.categorie.forEach(function (k, i) {
        var n = c.box.filter(function (p) { return p.categoria === k.id; }).length;
        h += '<div class="it"><span>' + esc(k.icona || '') + ' <b>' + esc(k.nome) + '</b><small>' + n + (n === 1 ? ' prodotto' : ' prodotti') + '</small></span>' +
          '<button class="btn sm"' + (i ? '' : ' disabled') + ' title="Sposta su" onclick="A.ecCatMove(\'' + jq(k.id) + '\',-1)">\u25b2</button>' +
          '<button class="btn sm"' + (i < c.categorie.length - 1 ? '' : ' disabled') + ' title="Sposta gi\u00f9" onclick="A.ecCatMove(\'' + jq(k.id) + '\',1)">\u25bc</button>' +
          '<button class="btn sm" onclick="A.ecCatEdit(\'' + jq(k.id) + '\')">Modifica</button>' +
          '<button class="btn sm danger" onclick="A.ecCatDel(\'' + jq(k.id) + '\')">Elimina</button></div>';
      });
      if (!c.categorie.length) h += '<p>Nessuna categoria. Premi \u201c+ Nuova categoria\u201d.</p>';
      M().innerHTML = h + '</div><small>L\u0027ordine qui \u00e8 l\u0027ordine dei bottoni filtro nel negozio.</small></div>';
    });
  };
  A.ecCatEdit = function (id) {
    load().then(function (c) {
      var k = id ? byId(c.d.categorie, id) : null; if (id && !k) throw new Error('Categoria non trovata: ricarica la pagina');
      k = k || { icona: '\ud83d\udecd\ufe0f' };
      $('topTitle').textContent = id ? 'Modifica categoria' : 'Nuova categoria';
      M().innerHTML = '<h2>' + (id ? 'Modifica categoria' : 'Nuova categoria') + '</h2><div class="card">' +
        '<label>Nome</label><input id="ek_nome" value="' + esc(k.nome || '') + '" placeholder="Es. Casa e benessere">' +
        '<label>Icona (una emoji)</label><input id="ek_ico" value="' + esc(k.icona || '') + '" maxlength="4">' +
        '<p><button class="btn primary" onclick="A.ecCatSave(\'' + jq(id || '') + '\')">Salva</button> <button class="btn" onclick="A.go(\'ecomcat\')">Annulla</button></p></div>';
    }).catch(fail);
  };
  A.ecCatSave = A.wrap(function (old) {
    var nome = $('ek_nome').value.trim(), ico = $('ek_ico').value.trim();
    if (!nome) return A.toast('Scrivi il nome della categoria', true);
    var id = old || A.slugify(nome);
    if (!ID_RE.test(id)) return A.toast('Nome non valido: usa lettere o numeri', true);
    return load().then(function (c) {
      var prev = byId(c.d.categorie, id);
      if (old && !prev) throw new Error('Categoria non trovata: ricarica la pagina');
      if (!old && prev) throw new Error('Esiste gi\u00e0 una categoria con questo nome: scegline un altro');
      if (prev) { prev.nome = nome; prev.icona = ico; } else c.d.categorie.push({ id: id, nome: nome, icona: ico });
      return save(c, 'admin: e-commerce categoria ' + (prev ? 'modifica ' : 'nuova ') + id).then(function () { A.toast('Salvato'); A.go('ecomcat'); });
    });
  });
  A.ecCatMove = A.wrap(function (id, dir) {
    return load().then(function (c) {
      var a = c.d.categorie, i = a.indexOf(byId(a, id)), j = i + dir;
      if (i < 0 || j < 0 || j >= a.length) return;
      var t = a[i]; a[i] = a[j]; a[j] = t;
      return save(c, 'admin: e-commerce ordine categorie').then(function () { A.go('ecomcat'); });
    });
  });
  A.ecCatDel = A.wrap(function (id) {
    return load().then(function (c) {
      var k = byId(c.d.categorie, id); if (!k) throw new Error('Categoria non trovata: ricarica la pagina');
      var n = c.d.box.filter(function (p) { return p.categoria === id; }).length;
      if (n) return A.toast('La categoria ha ancora ' + n + (n === 1 ? ' prodotto' : ' prodotti') + ': spostali in un\u0027altra categoria o eliminali prima', true);
      if (!confirm('Eliminare la categoria \u201c' + k.nome + '\u201d?')) return;
      c.d.categorie = c.d.categorie.filter(function (x) { return x.id !== id; });
      return save(c, 'admin: e-commerce elimina categoria ' + id).then(function () { A.toast('Eliminata'); A.go('ecomcat'); });
    });
  });

  /* ---------------- INTERRUTTORE in Impostazioni ----------------
     PUNTI CRITICI: (1) la vista Impostazioni e' di admin-media.js: qui la si AVVOLGE (questo file si carica DOPO admin-media.js in index.html) e si aggiunge una scheda
     "E-commerce" con il suo pulsante Salva. Non e' nel Salva generale: ha il suo, che rilegge _config.yml fresco (sha giusto). Se cambi l'ordine degli script in index.html la scheda sparisce.
     (2) La chiave e' `ecommerce` in prima colonna di _config.yml, letta da _plugins/ecommerce.rb: solo true accende, chiave assente = SPENTO. Se la riga manca la si aggiunge in fondo.
     (3) Si cambia solo il valore: il commento in coda alla riga e l'a-capo CRLF/LF del file restano. Dopo Salva serve il deploy (2-3 minuti). */
  var setOrig = A.views.settings;
  A.views.settings = function () {
    return setOrig().then(function () {
      return A.getFile('_config.yml').then(function (f) {
        var m = f.text.match(/^ecommerce:[ \t]*(\S+)/m), on = !!m && m[1].toLowerCase() === 'true', d = document.createElement('div'), mn = M();
        d.className = 'card';
        d.innerHTML = '<h3>E-commerce</h3><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="c_ecommerce" style="width:auto"' + (on ? ' checked' : '') + '> Abilita e-commerce</label>' +
          '<small>Acceso = il Negozio compare nel menu del sito, con carrello e pagine prodotto. Spento = Negozio, carrello, pagine prodotto e il gruppo E-commerce qui nell\u0027admin spariscono (prodotti e categorie restano salvati: riaccendendo ritrovi tutto com\u0027era). Dopo Salva serve il deploy (2-3 minuti).</small>' +
          '<p><button class="btn primary" onclick="A.ecToggle()">Salva e-commerce</button></p>';
        mn.insertBefore(d, mn.children[2] || null);
      }, function () { /* config illeggibile: Impostazioni funziona lo stesso, senza la scheda */ });
    });
  };
  A.ecToggle = A.wrap(function () {
    var val = $('c_ecommerce').checked ? 'true' : 'false';
    return A.getFile('_config.yml').then(function (f) {
      var t = f.text;
      if (/^ecommerce:/m.test(t)) t = t.replace(/^(ecommerce:[ \t]*)\S+/m, function (_q, a) { return a + val; });
      else { var eo = /\r\n/.test(t) ? '\r\n' : '\n'; t = t + (/\n$/.test(t) ? '' : eo) + 'ecommerce: ' + val + eo; }
      if (t === f.text) return A.toast('Nessuna modifica');
      return A.putFile('_config.yml', t, f.sha, 'admin: e-commerce ' + (val === 'true' ? 'acceso' : 'spento')).then(function () { A.ecShow(val === 'true'); A.toast('Salvato'); A.go('settings'); });
    });
  });

  /* ---------------- MENU ADMIN: gruppo "E-commerce" nascosto se spento ----------------
     PUNTI CRITICI: (1) Spento = sparisce il gruppo E-commerce (Prodotti, Categorie prodotti) dal menu a sinistra, insieme al sito. I DATI NON SI TOCCANO:
     _data/catalogo.json resta com'e', quindi riaccendendo ritrovi prodotti e categorie identici (un click, nessuna perdita). (2) Lo stato si legge da _config.yml
     (stessa regola del plugin: solo `ecommerce: true` accende) una volta al primo A.go dopo il login, e si aggiorna subito dopo "Salva e-commerce".
     (3) Il gruppo ha data-g="ecommerce" in index.html: se lo rinomini, cambia anche qui. */
  A.ecShow = function (on) { var g = document.querySelector('.grp[data-g="ecommerce"]'); if (g) g.style.display = on ? '' : 'none'; };
  var ecSynced = false, goOrig = A.go;
  A.go = function () {
    if (!ecSynced) {
      ecSynced = true;
      A.getFile('_config.yml').then(function (f) { var m = f.text.match(/^ecommerce:[ \t]*(\S+)/m); A.ecShow(!!m && m[1].toLowerCase() === 'true'); }, function () { /* config illeggibile: il gruppo resta com'e' */ });
    }
    return goOrig.apply(this, arguments);
  };
})(A);
