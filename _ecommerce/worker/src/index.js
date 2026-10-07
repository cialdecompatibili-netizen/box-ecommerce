// Worker box-ecommerce: checkout Stripe + webhook ordini su D1.
// PUNTI CRITICI
// 1) Il webhook legge il corpo GREZZO (request.text()) prima di qualsiasi parse: la firma Stripe e' calcolata sul testo esatto.
// 2) Prezzi e importi si leggono SEMPRE da catalogo.json qui nel Worker, mai dal browser.
// 3) Ordini idempotenti: INSERT OR IGNORE sull'id della sessione (Stripe puo' reinviare lo stesso evento).
// 4) Segreti con "wrangler secret put", MAI in wrangler.toml. SITO_URL deve finire con "/".
import CATALOGO from "../../catalogo.json";

const enc = new TextEncoder();

const CORS = (env) => ({
  "Access-Control-Allow-Origin": env.SITO_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

function risposta(corpo, stato, env) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "Content-Type": "application/json", ...CORS(env) },
  });
}

async function checkout(request, env) {
  let dati;
  try {
    dati = await request.json();
  } catch {
    return risposta({ errore: "JSON non valido" }, 400, env);
  }
  const box = CATALOGO.box.find((b) => b.id === dati.id);
  if (!box) return risposta({ errore: "Box inesistente" }, 404, env);

  const abb = box.tipo === "abbonamento";
  const p = new URLSearchParams();
  p.set("mode", abb ? "subscription" : "payment");
  p.set("locale", "it");
  p.set("success_url", env.SITO_URL + "grazie/");
  p.set("cancel_url", env.SITO_URL + "servizi/");
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "eur");
  p.set("line_items[0][price_data][unit_amount]", String(box.prezzo_centesimi));
  p.set("line_items[0][price_data][product_data][name]", box.nome);
  if (abb) {
    p.set("line_items[0][price_data][recurring][interval]", box.intervallo);
    p.set("line_items[0][price_data][recurring][interval_count]", String(box.ogni));
    p.set("subscription_data[metadata][box_id]", box.id);
  }
  p.set("shipping_address_collection[allowed_countries][0]", "IT");
  p.set("metadata[box_id]", box.id);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p,
  });
  const s = await r.json();
  if (!r.ok) return risposta({ errore: "Stripe", dettaglio: s.error && s.error.message }, 502, env);
  return risposta({ url: s.url }, 200, env);
}

function uguali(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function firmaValida(corpo, header, segreto) {
  let t = null;
  const v1 = [];
  for (const x of (header || "").split(",")) {
    const [k, v] = x.split("=");
    if (k === "t") t = v;
    if (k === "v1") v1.push(v);
  }
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const chiave = await crypto.subtle.importKey("raw", enc.encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", chiave, enc.encode(t + "." + corpo));
  const hex = [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((v) => uguali(v, hex));
}

async function webhook(request, env) {
  const corpo = await request.text();
  if (!(await firmaValida(corpo, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("firma non valida", { status: 400 });
  }
  const ev = JSON.parse(corpo);
  if (ev.type === "checkout.session.completed") {
    const s = ev.data.object;
    const sped = s.shipping_details || (s.collected_information && s.collected_information.shipping_details) || null;
    await env.DB.prepare(
      "INSERT OR IGNORE INTO ordini (id, email, box_id, importo, valuta, subscription_id, stato, spedizione_json, creato_il) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
      .bind(
        s.id,
        (s.customer_details && s.customer_details.email) || null,
        (s.metadata && s.metadata.box_id) || null,
        s.amount_total || 0,
        s.currency || "eur",
        s.subscription || null,
        s.payment_status === "paid" ? "pagato" : "da_pagare",
        sped ? JSON.stringify(sped) : null,
        new Date().toISOString()
      )
      .run();
  } else if (ev.type === "customer.subscription.deleted") {
    await env.DB.prepare("UPDATE ordini SET stato = 'disdetto' WHERE subscription_id = ?1").bind(ev.data.object.id).run();
  }
  return new Response("ok");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(env) });
    if (url.pathname === "/api/box" && request.method === "GET") return risposta(CATALOGO.box, 200, env);
    if (url.pathname === "/api/checkout" && request.method === "POST") return checkout(request, env);
    if (url.pathname === "/api/webhook" && request.method === "POST") return webhook(request, env);
    return risposta({ errore: "Non trovato" }, 404, env);
  },
};
