# E-commerce box-ecommerce (scheletro minimo)

Cartella con underscore: Jekyll NON la pubblica. Stack: sito statico su GitHub Pages, Worker Cloudflare (checkout + webhook), D1 per gli ordini, Stripe Checkout (abbonamenti mensili e acquisti singoli). Idee e limiti dei piani: `memoria.md` del modello alfoliotemplate1.

## Cosa c'e'
- `catalogo.json` prezzi e tipo di ogni box (PREZZI DI PROVA).
- `worker/src/index.js` API: `GET /api/box`, `POST /api/checkout` (body `{"id":"caffe-e-te"}` -> `{"url": ...}` di Stripe), `POST /api/webhook` (firma verificata, salva l'ordine, segna le disdette).
- `worker/schema.sql` tabella `ordini`. `worker/wrangler.toml` config.

## Per metterlo online (servono un account Cloudflare e uno Stripe)
Da `_ecommerce\worker`:
1. `npx wrangler login`
2. `npx wrangler d1 create box-ecommerce`, poi incollare il `database_id` in `wrangler.toml`.
3. `npx wrangler d1 execute box-ecommerce --remote --file=schema.sql`
4. `npx wrangler secret put STRIPE_SECRET_KEY` (chiave di TEST `sk_test_...` per cominciare).
5. `npx wrangler deploy`, annotare l'URL del Worker.
6. Stripe > Sviluppatori > Webhook: endpoint `<url worker>/api/webhook`, eventi `checkout.session.completed` e `customer.subscription.deleted`. Poi `npx wrangler secret put STRIPE_WEBHOOK_SECRET` con il `whsec_...`.
7. Pagina `/grazie/` sul sito (il Worker rimanda li' dopo il pagamento) e bottoni "Attiva" che chiamano `/api/checkout`.

## Da fare dopo
- Decidere i prezzi veri e i box di `catalogo.json`.
- Pagina negozio sul sito con i bottoni, pagina `/grazie/`, area per gestire/disdire (portale clienti Stripe).
- Email ordini (servizio gratuito da scegliere), backup periodico di D1.
- Pagamenti con la chiave live solo dopo i test; verificare termini d'uso e limiti di GitHub Pages per i siti commerciali (valutare Cloudflare Pages per il front-end).
