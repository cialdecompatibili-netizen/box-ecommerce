-- Schema D1 di box-ecommerce. Applicare con:
--   npx wrangler d1 execute box-ecommerce --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS ordini (
  id TEXT PRIMARY KEY,            -- id sessione Stripe Checkout (idempotenza webhook)
  email TEXT,
  box_id TEXT,
  importo INTEGER NOT NULL,       -- centesimi
  valuta TEXT NOT NULL DEFAULT 'eur',
  subscription_id TEXT,           -- solo abbonamenti
  stato TEXT NOT NULL,            -- pagato | da_pagare | disdetto
  spedizione_json TEXT,
  creato_il TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ordini_sub ON ordini (subscription_id);
CREATE INDEX IF NOT EXISTS idx_ordini_email ON ordini (email);
