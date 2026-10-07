// Carrello semplice di /negozio/: aggiungi, quantita', totale, svuota. Salvato nel browser (localStorage).
// PUNTI CRITICI
// 1) I prezzi mostrati arrivano da _data/catalogo.json (data-prezzo nella pagina); il Worker li rilegge da solo: qui non fanno fede.
// 2) Su /grazie/ non c'e' #negozio: il carrello viene svuotato (pagamento completato).
// 3) Il pagamento parte solo se _data/negozio.yml ha worker_url; altrimenti il pulsante resta spento.
(function () {
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

  var radice = document.getElementById("negozio");
  if (!radice) {
    if (/\/grazie\/?$/.test(location.pathname)) salva({});
    return;
  }

  var box = {};
  radice.querySelectorAll(".nz-box").forEach(function (c) {
    var prezzo = Number(c.dataset.prezzo);
    box[c.dataset.id] = { nome: c.dataset.nome, prezzo: prezzo };
    c.querySelector(".nz-prezzo").textContent = euro.format(prezzo / 100) + " " + c.dataset.periodo;
  });

  function disegna() {
    var c = leggi();
    var ids = Object.keys(c).filter(function (id) {
      return box[id] && c[id] > 0;
    });
    var righe = document.getElementById("nz-righe");
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

  radice.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    var c = leggi();
    if (b.classList.contains("nz-add")) {
      var card = b.closest(".nz-box");
      var q = parseInt(card.querySelector(".nz-qta").value, 10) || 1;
      q = Math.max(1, Math.min(MAX, q));
      c[card.dataset.id] = Math.min(MAX, (c[card.dataset.id] || 0) + q);
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
  });

  document.getElementById("nz-paga").addEventListener("click", function () {
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

  disegna();
})();
