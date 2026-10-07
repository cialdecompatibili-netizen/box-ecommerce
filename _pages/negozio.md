---
layout: page
title: Negozio
permalink: /negozio/
description: Scegli le tue box, indica la quantità e aggiungile al carrello.
nav: true
nav_order: 1
ecommerce: true
---
<link rel="stylesheet" href="{{ '/assets/css/negozio.css' | relative_url }}">
<div id="negozio" data-worker="{{ site.data.negozio.worker_url }}">
<div class="nz-pills">
<button type="button" class="nz-pill on" data-cat="">Tutti</button>
{% for c in site.data.catalogo.categorie %}
<button type="button" class="nz-pill" data-cat="{{ c.id }}">{{ c.icona }} {{ c.nome }}</button>
{% endfor %}
</div>
<div class="nz-lista">
{% for b in site.data.catalogo.box %}
{% if b.visibile == false %}{% continue %}{% endif %}
{% assign cat = site.data.catalogo.categorie | where: 'id', b.categoria | first %}
<div class="nz-riga nz-box" data-id="{{ b.id }}" data-cat="{{ b.categoria }}" data-nome="{{ b.nome | escape }}" data-prezzo="{{ b.prezzo_centesimi }}" data-tipo="{{ b.tipo }}" data-periodo="{% if b.tipo == 'abbonamento' %}{% if b.ogni > 1 %}ogni {{ b.ogni }} {% case b.intervallo %}{% when 'week' %}settimane{% when 'year' %}anni{% else %}mesi{% endcase %}{% else %}/ {% case b.intervallo %}{% when 'week' %}settimana{% when 'year' %}anno{% else %}mese{% endcase %}{% endif %}{% endif %}">
<div class="nz-icona">{{ b.icona }}</div>
<div class="nz-testo">
<p class="nz-cat">{{ cat.nome }}{% if b.tipo == 'abbonamento' %} · abbonamento{% else %} · acquisto singolo{% endif %}</p>
<h3><a href="{{ '/negozio/' | append: b.id | append: '/' | relative_url }}">{{ b.nome }}</a></h3>
<p>{{ b.descrizione }}</p>
</div>
<div class="nz-prezzo fw-bold"></div>
<div class="nz-azioni">
<label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
<button type="button" class="btn btn-primary nz-add">Aggiungi</button>
<span class="nz-ok" aria-live="polite"></span>
</div>
</div>
{% endfor %}
</div>
<h2 id="carrello">Carrello <small id="nz-conta" class="text-muted"></small></h2>
<p id="nz-vuoto">Il carrello è vuoto.</p>
<div id="nz-pieno" hidden>
<table class="nz-tab">
<thead><tr><th>Box</th><th>Quantità</th><th>Totale</th><th></th></tr></thead>
<tbody id="nz-righe"></tbody>
</table>
<p>Totale <span id="nz-totale" class="nz-totale"></span></p>
<button type="button" id="nz-paga" class="btn btn-primary">Procedi al pagamento</button>
<button type="button" id="nz-svuota" class="btn btn-outline-secondary">Svuota il carrello</button>
<p id="nz-nota" class="text-muted mt-2"></p>
</div>
<script src="{{ '/assets/js/carrello.js' | relative_url }}" defer></script>
</div>
