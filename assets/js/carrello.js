// Carrello del negozio: icona nel menu con contatore (su TUTTE le pagine), finestra "aggiunto al carrello" (stile PrestaShop)
// e carrello completo in /negozio/. Salvato nel browser (localStorage).
// PUNTI CRITICI
// 1) Questo file e' caricato UNA volta da _includes/header.liquid (solo se ecommerce: true). NON rimettere <script src=carrello.js> nelle pagine:
//    il guard window.__nzCarrello evita il doppio avvio, ma il tag in piu' non serve.
// 2) Il contatore e i totali usano la JSON id/prezzo/nome scritto dal header in #nz-cart[data-catalogo] (stessa fonte: _data/catalogo.json). Gli id non piu'
//    in catalogo (prodotto nascosto/eliminato) NON si contano. I prezzi mostrati sono solo indicativi: il Worker li rilegge da solo al pagamento.
// 3) Su /grazie/ il carrello viene svuotato (pagamento completato).
// 4) Il pagamento parte solo se _data/negozio.yml ha worker_url; altrimenti il pulsante resta spento.
// 5) La finestra "aggiunto" e' un <dialog> nativo creato qui (testi con textContent, mai innerHTML: i nomi arrivano da data-*). Gli stili sono in negozio.css.
// 6) Le pagine prodotto non hanno la tabella carrello (#nz-righe): disegna() esce subito, il contatore e la finestra funzionano lo stesso.
(function () {
  if (window.__nzCarrello) return;
  window.__nzCarrello = true;

  var KEY = "box_carrello";
  var MAX = 20;
  var euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

  function leggi() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function salva(c) {
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function el(tag, testo, classe) {
    var x = document.createElement(tag);
    if (testo !== undefined) x.textContent = testo;
    if (classe) x.className = classe;
    return x;
  }
  function tasto(testo, act, id, classe) {
    var b = el("button", testo, classe || "btn btn-sm btn-outline-secondary");
    b.type = "button";
    b.dataset.act = act;
    b.dataset.id = id;
    return b;
  }

  /* ---------- icona nel menu + contatore ---------- */
  var link = document.getElementById("nz-cart");
  var prezzi = {}; // id -> centesimi (dal header)
  var nomi = {}; // id -> nome (dal header, per l'anteprima)
  if (link && link.dataset.catalogo) {
    try {
      JSON.parse("[" + link.dataset.catalogo + "null]").forEach(function (x) {
        if (x && x.id) {
          prezzi[x.id] = Number(x.p) || 0;
          nomi[x.id] = String(x.n || x.id);
        }
      });
    } catch (e) {}
  }
  function riepilogo(c) {
    var n = 0;
    var tot = 0;
    Object.keys(c).forEach(function (id) {
      if (prezzi[id] !== undefined && c[id] > 0) {
        n += c[id];
        tot += prezzi[id] * c[id];
      }
    });
    return { n: n, tot: tot };
  }
  /* Anteprima al passaggio del mouse (come .blockcart .body di PrestaShop): righe "q x nome", totale, pulsante. Solo CSS la mostra (desktop con mouse). */
  function anteprima(r) {
    var p = document.getElementById("nz-prev");
    if (!p) return;
    p.innerHTML = "";
    if (!r.n) return; // carrello vuoto: nessuna anteprima (resta nascosta anche da CSS)
    var c = leggi();
    var ul = el("ul");
    Object.keys(c).forEach(function (id) {
      if (prezzi[id] === undefined || !(c[id] > 0)) return;
      var li = el("li");
      li.appendChild(el("span", c[id] + " \u00d7 " + nomi[id]));
      li.appendChild(el("span", euro.format((prezzi[id] * c[id]) / 100)));
      ul.appendChild(li);
    });
    var tot = el("p", undefined, "nz-prev-tot");
    tot.appendChild(el("span", "Totale"));
    tot.appendChild(el("strong", euro.format(r.tot / 100)));
    var vai = el("a", "Vai al carrello", "btn btn-primary btn-sm");
    vai.href = link.getAttribute("href");
    [ul, tot, vai].forEach(function (n) {
      p.appendChild(n);
    });
  }
  function badge(salto) {
    if (!link) return;
    var r = riepilogo(leggi());
    link.querySelector(".nz-n").textContent = "(" + r.n + ")";
    link.classList.toggle("nz-pieno", r.n > 0);
    link.setAttribute("aria-label", "Carrello: " + r.n + (r.n === 1 ? " prodotto" : " prodotti"));
    anteprima(r);
    if (salto) {
      link.classList.remove("nz-bump");
      void link.offsetWidth; // riavvia l'animazione
      link.classList.add("nz-bump");
    }
  }

  var radice = document.getElementById("negozio");
  if (!radice) {
    if (/\/grazie\/?$/.test(location.pathname)) salva({});
    badge();
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) badge();
    });
    return;
  }

  /* ---------- prodotti presenti nella pagina ---------- */
  var box = {};
  radice.querySelectorAll(".nz-box").forEach(function (c) {
    var prezzo = Number(c.dataset.prezzo);
    box[c.dataset.id] = { nome: c.dataset.nome, prezzo: prezzo, periodo: c.dataset.periodo || "" };
    prezzi[c.dataset.id] = prezzo;
    c.querySelector(".nz-prezzo").textContent = euro.format(prezzo / 100) + " " + (c.dataset.periodo || "");
  });

  /* ---------- carrello completo (solo /negozio/) ---------- */
  function disegna() {
    badge();
    var righe = document.getElementById("nz-righe");
    if (!righe) return;
    var c = leggi();
    var ids = Object.keys(c).filter(function (id) {
      return box[id] && c[id] > 0;
    });
    var tot = 0;
    var n = 0;
    righe.innerHTML = "";
    ids.forEach(function (id) {
      var q = c[id];
      var tr = el("tr");
      var q_td = el("td");
      var q_box = el("span", undefined, "nz-q");
      q_box.appendChild(tasto("-", "meno", id));
      q_box.appendChild(el("span", String(q)));
      q_box.appendChild(tasto("+", "piu", id));
      q_td.appendChild(q_box);
      var x_td = el("td");
      x_td.appendChild(tasto("Togli", "togli", id));
      tr.appendChild(el("td", box[id].nome));
      tr.appendChild(q_td);
      tr.appendChild(el("td", euro.format((box[id].prezzo * q) / 100)));
      tr.appendChild(x_td);
      righe.appendChild(tr);
      tot += box[id].prezzo * q;
      n += q;
    });
    document.getElementById("nz-vuoto").hidden = ids.length > 0;
    document.getElementById("nz-pieno").hidden = ids.length === 0;
    document.getElementById("nz-totale").textContent = euro.format(tot / 100);
    document.getElementById("nz-conta").textContent = n ? "(" + n + ")" : "";
    var paga = document.getElementById("nz-paga");
    var worker = radice.dataset.worker;
    paga.disabled = !worker;
    document.getElementById("nz-nota").textContent = worker ? "" : "Modalità test: il pagamento non è ancora collegato.";
  }

  /* ---------- finestra "prodotto aggiunto" (come PrestaShop) ---------- */
  function apri(id, aggiunta) {
    var d = document.getElementById("nz-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "nz-dialog";
      d.className = "nz-dialog";
      d.setAttribute("aria-labelledby", "nz-dlg-tit");
      document.body.appendChild(d);
      d.addEventListener("click", function (ev) {
        // click sullo sfondo (il <dialog> stesso) o su un elemento con data-chiudi
        if (ev.target === d || ev.target.closest("[data-chiudi]")) d.close();
      });
    }
    var p = box[id];
    var r = riepilogo(leggi());
    d.innerHTML = "";
    var w = el("div", undefined, "nz-dlg");
    var x = el("button", "\u00d7", "nz-x");
    x.type = "button";
    x.dataset.chiudi = "1";
    x.setAttribute("aria-label", "Chiudi");
    var h = el("h2", "\u2713 Prodotto aggiunto al carrello");
    h.id = "nz-dlg-tit";
    var pr = el("div", undefined, "nz-dlg-prod");
    pr.appendChild(el("strong", p.nome));
    pr.appendChild(el("span", euro.format(p.prezzo / 100) + " " + p.periodo));
    pr.appendChild(el("span", aggiunta ? "Quantità aggiunta: " + aggiunta : "Quantità massima raggiunta (" + MAX + ")"));
    var tt = el("div", undefined, "nz-dlg-tot");
    tt.appendChild(el("p", r.n === 1 ? "Nel carrello c\u2019è 1 prodotto" : "Nel carrello ci sono " + r.n + " prodotti"));
    tt.appendChild(el("p", "Totale: " + euro.format(r.tot / 100), "nz-totale"));
    var az = el("div", undefined, "nz-dlg-az");
    var b1 = el("button", "Continua lo shopping", "btn btn-outline-secondary");
    b1.type = "button";
    b1.dataset.chiudi = "1";
    var b2 = el("a", "Procedi con l\u2019ordine", "btn btn-primary");
    b2.href = link ? link.getAttribute("href") : "#carrello";
    b2.dataset.chiudi = "1";
    az.appendChild(b1);
    az.appendChild(b2);
    [x, h, pr, tt, az].forEach(function (n) {
      w.appendChild(n);
    });
    d.appendChild(w);
    if (typeof d.showModal === "function") {
      if (!d.open) d.showModal();
    } else {
      d.setAttribute("open", ""); // browser vecchi senza <dialog> modale
    }
    b2.focus();
  }

  /* ---------- azioni ---------- */
  radice.addEventListener("click", function (ev) {
    var pill = ev.target.closest(".nz-pill");
    if (pill) {
      radice.querySelectorAll(".nz-pill").forEach(function (b) {
        b.classList.toggle("on", b === pill);
      });
      radice.querySelectorAll(".nz-lista .nz-box").forEach(function (r) {
        r.hidden = !!pill.dataset.cat && r.dataset.cat !== pill.dataset.cat;
      });
      return;
    }
    var b = ev.target.closest("button");
    if (!b) return;
    var c = leggi();
    var aggId = "";
    var aggiunta = 0;
    if (b.classList.contains("nz-add")) {
      var card = b.closest(".nz-box");
      var q = parseInt(card.querySelector(".nz-qta").value, 10) || 1;
      q = Math.max(1, Math.min(MAX, q));
      aggId = card.dataset.id;
      var prima = c[aggId] || 0;
      c[aggId] = Math.min(MAX, prima + q);
      aggiunta = c[aggId] - prima;
      card.querySelector(".nz-qta").value = 1;
    } else if (b.dataset.act === "piu") {
      c[b.dataset.id] = Math.min(MAX, (c[b.dataset.id] || 0) + 1);
    } else if (b.dataset.act === "meno") {
      c[b.dataset.id] = (c[b.dataset.id] || 0) - 1;
      if (c[b.dataset.id] <= 0) delete c[b.dataset.id];
    } else if (b.dataset.act === "togli") {
      delete c[b.dataset.id];
    } else if (b.id === "nz-svuota") {
      c = {};
    } else {
      return;
    }
    salva(c);
    disegna();
    if (aggId) {
      badge(true);
      apri(aggId, aggiunta);
    }
  });

  var paga = document.getElementById("nz-paga");
  if (paga) {
    paga.addEventListener("click", function () {
      var worker = radice.dataset.worker;
      var c = leggi();
      var items = Object.keys(c)
        .filter(function (id) {
          return box[id] && c[id] > 0;
        })
        .map(function (id) {
          return { id: id, qty: c[id] };
        });
      if (!worker || !items.length) return;
      fetch(worker.replace(/\/$/, "") + "/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (d.url) location.href = d.url;
          else alert(d.errore || "Errore nel pagamento");
        })
        .catch(function () {
          alert("Errore di rete");
        });
    });
  }

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) disegna();
  });

  disegna();
})();
