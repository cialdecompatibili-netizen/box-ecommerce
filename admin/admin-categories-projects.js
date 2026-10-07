/* Categorie progetti: elenco, rinomina/unisci, elimina, mostra/togli dalla pagina Progetti e ordine (frecce). Vedi claude.md > "Categorie progetti".
   COME FUNZIONANO (diverso dalle categorie degli articoli, che stanno in admin-categories.js):
   - Ogni progetto ha UN campo 'category: nome' (singolare, UNA parola) nel front matter. Non esiste un elenco proprio: la categoria esiste perche' un progetto la usa.
   - La pagina pubblica _pages/projects.md mostra SOLO le categorie scritte in 'display_categories: [a, b]' nel proprio front matter, nell'ordine dell'elenco, e solo se
     'enable_project_categories: true' in _config.yml. Un progetto con una categoria NON in elenco, o senza categoria, NON compare in /projects/ (resta nel sito, raggiungibile dal suo indirizzo).
     [DEDOTTO dal codice di _pages/projects.md del repo (ciclo su page.display_categories con "where: category"), NON documentato: riverificare se la pagina cambia o se si aggiorna al-folio]
   - Quindi "gestire una categoria" = riscrivere 'category' nei progetti E tenere allineato 'display_categories'. Ogni azione e' UN SOLO commit (A.commitFiles: un solo deploy, o passa tutto o niente).
   PUNTI CRITICI:
   (1) 'display_categories' si legge/scrive SOLO nella forma su una riga '[a, b]' (quella del tema). Se e' scritta su piu' righe si rifiuta (parseList) invece di riscriverla alla cieca.
   (2) Il valore di 'category' passa da A.slugify: una parola senza spazi ne' due punti, quindi si scrive senza virgolette (come admin-bulk.js).
   (3) Si riusa lo stesso a capo (CRLF/LF) del file letto e il corpo non si tocca mai (vedi rewrite): nei repo gli a capo sono misti e un cambio di a capo riscriverebbe tutto il file nel diff.
   (4) Ogni file viaggia con lo sha letto: se qualcuno lo cambia nel frattempo il commit fallisce (409) e non scrive niente (vedi A.commitFiles in admin.js). */
(function (A) {
  var esc = A.esc, M = function () { return A.main(); };
  var DIR = '_projects', PAGE = '_pages/projects.md', PKEY = 'display_categories';
  var PROJ = [];        // {path, sha, text, cat}
  var PG = null;        // pagina Progetti: {sha, text, list: [..] | null, bad: 'messaggio'} oppure null se il file non c'e'
  var CATS_ON = true;   // enable_project_categories in _config.yml (assente = come il tema: acceso)

  function pl(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function note(t) { return '<div class="card"><small>' + esc(t) + '</small></div>'; }

  /* Legge 'display_categories' dal front matter. Ritorna l'array, oppure null se la chiave non c'e' (allora la pagina mostra TUTTI i progetti senza dividerli).
     Forma accettata: UNA riga '[a, b]'. Elenco su piu' righe ('- a') o altro: errore chiaro, nessuna riscrittura (punto critico 1). */
  function parseList(fm) {
    var m = fm.match(/^display_categories:[ \t]*(.*?)[ \t]*\r?$/m);
    if (!m) return null;
    var b = m[1].replace(/\s+#.*$/, '').match(/^\[(.*)\]$/);
    if (!b) throw new Error('Nella pagina Progetti l\'elenco delle categorie e\' scritto in un modo che l\'admin non sa modificare (deve stare su una riga, per esempio [work, fun]). Sistemalo a mano e riapri questa pagina.');
    return b[1].split(',').map(function (x) { return x.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
  }
  function fmtList(a) { return '[' + a.map(function (x) { return A.yq(x); }).join(', ') + ']'; }

  /* Riscrive il front matter di un file con fn(fm) -> nuovo fm. Stesso a capo del file, corpo identico (punto critico 3). */
  function rewrite(text, fn) {
    var s = A.splitFM(text); if (!s.fm) throw new Error('Front matter non trovato');
    var nl = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    return '---' + nl + fn(s.fm).replace(/\r?\n+$/, '') + nl + '---' + nl + s.body;
  }
  /* la pagina divide davvero per categoria e l'admin sa riscriverla? Solo allora ha senso Mostra/Togli e l'avviso sui progetti senza categoria */
  function uses() { return !!(CATS_ON && PG && !PG.bad && PG.list); }
  function needOk() { if (PG && PG.bad) throw new Error(PG.bad); }

  /* frecce su/giu' di una categoria della pagina: pos = posto attuale, n = quante sono in pagina. La freccia e' spenta ai due estremi. */
  function mv(q, pos, n) {
    function b(d, txt, off) { return '<button class="btn sm"' + (off ? ' disabled' : ' onclick="A.pcMove(\'' + q + '\',' + d + ')"') + ' title="' + (d < 0 ? 'Sposta su' : 'Sposta gi\u00f9') + ' nella pagina Progetti">' + txt + '</button>'; }
    return b(-1, '\u2191', pos <= 0) + b(1, '\u2193', pos >= n - 1);
  }

  function load() {
    return A.getDir(DIR).then(function (l) {
      l = l.filter(function (f) { return f.type === 'file' && /\.md$/.test(f.name); });
      return A.getFiles(DIR, l); /* una query GraphQL + cache per sha invece di N richieste */
    }).then(function (fs) {
      PROJ = fs.filter(Boolean).map(function (f) { return { path: f.path, sha: f.sha, text: f.text, cat: A.fmGet(A.splitFM(f.text).fm, 'category') }; });
      return A.getFile(PAGE).then(null, function (e) { if (e.status === 404) return null; throw e; });
    }).then(function (f) {
      PG = null;
      if (f) {
        PG = { sha: f.sha, text: f.text, list: null, bad: '' };
        try { PG.list = parseList(A.splitFM(f.text).fm); } catch (e) { PG.bad = e.message; }
      }
      return A.getFile('_config.yml').then(null, function () { return null; });
    }).then(function (c) {
      var m = c && c.text.match(/^enable_project_categories:[ \t]*(\w+)/m);
      CATS_ON = !m || m[1].toLowerCase() !== 'false';
    });
  }
  /* nome -> numero di progetti che la usano */
  function counts() {
    var c = {};
    PROJ.forEach(function (p) { if (p.cat) c[p.cat] = (c[p.cat] || 0) + 1; });
    return c;
  }
  /* Nuova lista della pagina dopo un'operazione: fn riceve una COPIA dell'elenco e ritorna quello nuovo. null = niente da cambiare (pagina assente, senza elenco o elenco uguale). */
  function listAfter(fn) {
    if (!PG || PG.bad || !PG.list) return null;
    var out = fn(PG.list.slice());
    return out.join('\u0001') === PG.list.join('\u0001') ? null : out;
  }
  /* UN commit con i progetti cambiati + la pagina Progetti (se l'elenco cambia) */
  function commit(changes, newList, msg) {
    if (newList) changes.push({ path: PAGE, sha: PG.sha, text: rewrite(PG.text, function (fm) { return A.fmSet(fm, PKEY, fmtList(newList)); }) });
    return A.commitFiles(changes, msg);
  }

  A.views.pcats = function () {
    return load().then(function () {
      var c = counts(), seen = {}, names = [], inList = {}, list = (PG && PG.list) || [];
      list.forEach(function (n) { inList[n] = 1; if (!seen[n]) { seen[n] = 1; names.push(n); } }); /* prima le categorie della pagina, nel suo ordine */
      Object.keys(c).sort().forEach(function (n) { if (!seen[n]) { seen[n] = 1; names.push(n); } });
      var ord = names.filter(function (n) { return inList[n]; }); /* solo quelle in pagina, nell'ordine di display_categories: servono alle frecce */
      var h = '<h2>Categorie progetti</h2>';
      if (PG && PG.bad) h += '<div class="card"><p style="color:#b32d2e"><b>Attenzione:</b> ' + esc(PG.bad) + '</p></div>';
      else if (!PG) h += note('Non trovo la pagina Progetti (_pages/projects.md): puoi rinominare ed eliminare le categorie, ma non scegliere quali mostrare nella pagina.');
      else if (!CATS_ON) h += note('Le categorie dei progetti sono spente nelle impostazioni del sito: la pagina Progetti mostra tutti i progetti insieme, senza dividerli.');
      else if (!PG.list) h += note('La pagina Progetti non divide i progetti per categoria: li mostra tutti insieme. Le categorie servono solo a tenerli in ordine.');
      h += '<div class="card"><p>Le categorie sono i titoli in cui e\' divisa la pagina Progetti del sito. Una categoria nasce quando la dai a un progetto (Modifica, oppure spunta i progetti nell\'elenco e premi Categoria...). Qui puoi rinominarla, unirla a un\'altra (rinomina con il nome dell\'altra), eliminarla' +
        (uses() ? ' e scegliere quali mostrare nella pagina e in che ordine (frecce)' : '') + '. Ogni azione e\' un solo salvataggio.</p><div class="list">';
      if (!names.length) h += '<div class="it"><span>Nessuna categoria usata.</span></div>';
      names.forEach(function (n) {
        var cnt = c[n] || 0, shown = !!inList[n], q = A.jq(n), pos = ord.indexOf(n);
        var st = cnt ? pl(cnt, 'progetto', 'progetti') : 'nessun progetto';
        var warn = false;
        if (uses()) { if (shown) st += ' \u00b7 visibile nella pagina Progetti'; else { st += ' \u00b7 NON visibile nella pagina Progetti'; warn = cnt > 0; } }
        h += '<div class="it"><span>' + esc(n) + '<small' + (warn ? ' style="color:#b32d2e"' : '') + '>' + esc(st) + '</small></span>' +
          (uses() && shown ? mv(q, pos, ord.length) : '') + (uses() ? '<button class="btn sm" onclick="A.pcToggle(\'' + q + '\',' + (shown ? 'false' : 'true') + ')">' + (shown ? 'Togli dalla pagina' : 'Mostra nella pagina') + '</button>' : '') +
          '<button class="btn sm" onclick="A.pcRen(\'' + q + '\')">Rinomina</button>' +
          '<button class="btn sm danger" onclick="A.pcDel(\'' + q + '\')">Elimina</button></div>';
      });
      h += '</div></div>';
      var nocat = PROJ.filter(function (p) { return !p.cat; }).length;
      if (nocat && uses()) h += '<div class="card"><small>' + esc(nocat === 1 ? '1 progetto non ha' : nocat + ' progetti non hanno') + ' nessuna categoria, quindi non compa' + (nocat === 1 ? 're' : 'iono') + ' nella pagina Progetti. Assegnala dall\'elenco Progetti (spunta e premi Categoria...).</small> <button class="btn sm" onclick="A.go(\'projects\')">Vai ai Progetti</button></div>';
      M().innerHTML = h;
    });
  };

  /* Rinomina 'da' in 'a'. Se 'a' esiste gia' le due si UNISCONO (anche nell'elenco della pagina: 'da' sparisce, 'a' resta dov'e'). */
  A.pcRen = A.wrap(function (da) {
    needOk();
    var raw = prompt('Nuovo nome per "' + da + '" (una parola, senza spazi).\nSe scrivi il nome di un\'altra categoria le unisci:', da);
    if (raw === null || !raw.trim()) return;
    var a = A.slugify(raw); /* punto critico 2 */
    if (a === da) return;
    var ch = [];
    PROJ.forEach(function (p) {
      if (p.cat !== da) return;
      ch.push({ path: p.path, sha: p.sha, text: rewrite(p.text, function (fm) { return A.fmSet(fm, 'category', a); }) });
    });
    var nl = listAfter(function (l) {
      var i = l.indexOf(da);
      if (i < 0) return l;
      if (l.indexOf(a) >= 0) l.splice(i, 1); else l[i] = a;
      return l;
    });
    if (!ch.length && !nl) return;
    return commit(ch, nl, 'admin: categoria progetti ' + da + ' -> ' + a).then(function () { A.toast('Rinominata in ' + a + ' (' + pl(ch.length, 'progetto', 'progetti') + ', pubblicazione in corso)'); A.go('pcats'); });
  });

  /* Elimina 'n': la toglie dai progetti che la usano (restano nel sito, senza categoria) e dall'elenco della pagina. */
  A.pcDel = A.wrap(function (n) {
    needOk();
    var ch = [];
    PROJ.forEach(function (p) {
      if (p.cat !== n) return;
      ch.push({ path: p.path, sha: p.sha, text: rewrite(p.text, function (fm) { return A.fmDel(fm, 'category'); }) });
    });
    var nl = listAfter(function (l) { return l.filter(function (x) { return x !== n; }); });
    if (!ch.length && !nl) return;
    var msg = ch.length
      ? 'Togliere la categoria "' + n + '" da ' + pl(ch.length, 'progetto', 'progetti') + '?\nI progetti non vengono cancellati.' + (uses() ? ' Ma senza categoria non compaiono nella pagina Progetti finche\' non ne assegni un\'altra.' : '')
      : 'Togliere "' + n + '" dall\'elenco della pagina Progetti? Nessun progetto la usa.';
    if (!confirm(msg)) return;
    return commit(ch, nl, 'admin: elimina categoria progetti ' + n).then(function () { A.toast('Categoria eliminata (pubblicazione in corso)'); A.go('pcats'); });
  });

  /* Mostra / togli dalla pagina Progetti: cambia SOLO 'display_categories', i progetti non si toccano. Una categoria nuova si aggiunge in fondo. */
  A.pcToggle = A.wrap(function (n, on) {
    needOk();
    var nl = listAfter(function (l) {
      if (on) { if (l.indexOf(n) < 0) l.push(n); return l; }
      return l.filter(function (x) { return x !== n; });
    });
    if (!nl) return;
    return commit([], nl, 'admin: pagina progetti ' + (on ? 'mostra ' : 'togli ') + n).then(function () { A.toast(on ? 'Ora e\' nella pagina Progetti (pubblicazione in corso)' : 'Tolta dalla pagina Progetti (pubblicazione in corso)'); A.go('pcats'); });
  });

  /* Sposta una categoria su (d = -1) o giu' (d = +1) nella pagina Progetti. L'ordine e' quello di 'display_categories' (ogni categoria e' un titolo nella pagina, dall'alto in basso):
     si scambia con la vicina e basta, i progetti non si toccano. Ogni clic = un commit = un deploy: per spostare di molti posti conviene aspettare il pallino verde tra un clic e l'altro. */
  A.pcMove = A.wrap(function (n, d) {
    needOk();
    var nl = listAfter(function (l) {
      var i = l.indexOf(n), j = i + d;
      if (i < 0 || j < 0 || j >= l.length) return l;
      var x = l[i]; l[i] = l[j]; l[j] = x;
      return l;
    });
    if (!nl) return;
    return commit([], nl, 'admin: ordine categorie progetti (' + n + (d < 0 ? ' su' : ' gi\u00f9') + ')').then(function () { A.toast('Ordine cambiato (pubblicazione in corso)'); A.go('pcats'); });
  });
})(A);
