---
layout: page
title: Negozio
permalink: /negozio/
description: Scegli le tue box, indica la quantità e aggiungile al carrello.
nav: true
nav_order: 1
---
<style>
.nz-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin-bottom:2rem}
.nz-box .card-body{display:flex;flex-direction:column;gap:.5rem;height:100%}
.nz-azioni{display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap;margin-top:auto}
.nz-qta{width:5rem}
.nz-tab{width:100%;margin-bottom:1rem}
.nz-tab td,.nz-tab th{padding:.4rem .5rem;vertical-align:middle}
.nz-q{display:inline-flex;gap:.35rem;align-items:center}
.nz-totale{font-size:1.25rem;font-weight:700}
</style>
<div id="negozio" data-worker="{{ site.data.negozio.worker_url }}">
<div class="nz-griglia">
{% for b in site.data.catalogo.box %}
<div class="card nz-box" data-id="{{ b.id }}" data-nome="{{ b.nome | escape }}" data-prezzo="{{ b.prezzo_centesimi }}" data-tipo="{{ b.tipo }}" data-periodo="{% if b.tipo == 'abbonamento' %}/ mese{% endif %}">
<div class="card-body">
<h3 class="h5">{{ b.nome }}</h3>
<p>{{ b.descrizione }}</p>
<p class="nz-prezzo fw-bold"></p>
<div class="nz-azioni">
<label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
<button type="button" class="btn btn-primary nz-add">Aggiungi al carrello</button>
</div>
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
