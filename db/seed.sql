-- Seed de desenvolvimento (produtos de exemplo)
-- Uso: bun run db:seed

INSERT OR IGNORE INTO products (barcode, name, priceInCents) VALUES
  ('7891000100103', 'Café 500g',            1890),
  ('7894900011517', 'Refrigerante 350ml',    550),
  ('7896004400114', 'Chocolate 90g',         899);