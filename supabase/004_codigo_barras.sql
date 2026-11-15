-- =====================================================================
-- Escaneo de productos: código de barras en alimentos (datos de Open Food Facts)
-- =====================================================================

alter table alimentos add column if not exists codigo_barras text unique;
alter table alimentos add column if not exists marca text;

-- La web puede crear alimentos escaneados (solo con fuente 'off' y a tu nombre)
drop policy if exists alimentos_insert_off on alimentos;
create policy alimentos_insert_off on alimentos for insert to authenticated
  with check (fuente = 'off' and creado_por in (select mis_chat_ids()));
