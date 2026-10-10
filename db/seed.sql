-- Seed de desenvolvimento (dados mínimos para exercitar o fluxo)
-- Uso: bun run db:seed

INSERT OR IGNORE INTO devices (kind, name, token, createdAt) VALUES
  ('DOOR',  'Porta de entrada', 'dev-door-token',  strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('TOTEM', 'Totem do caixa',   'dev-totem-token', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO products (barcode, name, priceInCents) VALUES
  ('7891000100103', 'Café 500g',            1890),
  ('7894900011517', 'Refrigerante 350ml',    550),
  ('7896004400114', 'Chocolate 90g',         899);
