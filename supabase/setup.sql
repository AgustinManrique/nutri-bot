-- Setup completo: pegá TODO esto en Supabase → SQL Editor → Run (se puede correr más de una vez)

-- ===== supabase/001_schema.sql =====
-- =====================================================================
-- Nutri-bot: schema inicial
-- Correr completo en Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Usuarios (keyed por chat_id de Telegram; para escalar a multiusuario
-- ya está preparado)
-- ---------------------------------------------------------------------
create table if not exists usuarios (
  chat_id        bigint primary key,
  nombre         text,
  sexo           text check (sexo in ('M','F')),
  edad           int,
  peso_kg        numeric(5,1),
  altura_cm      numeric(5,1),
  actividad      text check (actividad in ('sedentario','ligero','moderado','alto','muy_alto')),
  objetivo       text check (objetivo in ('bajar','mantener','subir')),
  kcal_meta      int,
  proteina_meta  int,
  carbos_meta    int,
  grasas_meta    int,
  notas          text,          -- preferencias, cosas que no come, etc.
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Base de alimentos (valores cada 100 g / 100 ml)
-- ---------------------------------------------------------------------
create table if not exists alimentos (
  id             bigserial primary key,
  nombre         text not null,
  alias          text[] not null default '{}',
  categoria      text not null default 'alimento' check (categoria in ('alimento','bebida','suplemento')),
  kcal_100       numeric not null,
  proteina_100   numeric not null,
  carbos_100     numeric not null,
  grasas_100     numeric not null,
  porcion_nombre text,           -- "1 unidad", "1 scoop", "1 taza"
  porcion_g      numeric,        -- gramos de esa porción
  fuente         text not null default 'manual', -- manual | estimado_ia | usda | off
  creado_por     bigint references usuarios(chat_id) on delete set null,
  creado         timestamptz not null default now()
);
create index if not exists alimentos_nombre_trgm on alimentos using gin (nombre gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Registro de comidas (cada fila = un alimento consumido)
-- ---------------------------------------------------------------------
create table if not exists comidas (
  id           bigserial primary key,
  chat_id      bigint not null references usuarios(chat_id) on delete cascade,
  fecha        date not null,
  momento      text check (momento in ('desayuno','almuerzo','merienda','cena','snack','pre_entreno','post_entreno')),
  descripcion  text,
  alimento_id  bigint references alimentos(id) on delete set null,
  gramos       numeric,
  kcal         numeric not null,
  proteina     numeric not null,
  carbos       numeric not null,
  grasas       numeric not null,
  creado       timestamptz not null default now()
);
create index if not exists comidas_chat_fecha on comidas (chat_id, fecha);

-- ---------------------------------------------------------------------
-- Entrenamientos
-- ---------------------------------------------------------------------
create table if not exists entrenamientos (
  id              bigserial primary key,
  chat_id         bigint not null references usuarios(chat_id) on delete cascade,
  fecha           date not null,
  tipo            text not null,     -- pesas, running, fútbol, etc.
  descripcion     text,
  duracion_min    int,
  intensidad      text check (intensidad in ('baja','media','alta')),
  kcal_estimadas  int,
  creado          timestamptz not null default now()
);
create index if not exists entrenamientos_chat_fecha on entrenamientos (chat_id, fecha);

-- ---------------------------------------------------------------------
-- Despensa: lo que tenés en alacena / heladera / suplementos
-- ---------------------------------------------------------------------
create table if not exists despensa (
  id           bigserial primary key,
  chat_id      bigint not null references usuarios(chat_id) on delete cascade,
  nombre       text not null,
  alimento_id  bigint references alimentos(id) on delete set null,
  cantidad     text,                 -- libre: "1 kg", "media docena", "casi vacío"
  tipo         text not null default 'alimento' check (tipo in ('alimento','suplemento')),
  actualizado  timestamptz not null default now(),
  unique (chat_id, nombre)
);

-- ---------------------------------------------------------------------
-- Historial de conversación (contexto para el LLM)
-- ---------------------------------------------------------------------
create table if not exists mensajes (
  id       bigserial primary key,
  chat_id  bigint not null references usuarios(chat_id) on delete cascade,
  rol      text not null check (rol in ('user','model')),
  texto    text not null,
  creado   timestamptz not null default now()
);
create index if not exists mensajes_chat_creado on mensajes (chat_id, creado desc);

-- Para no procesar dos veces el mismo update si Telegram reintenta
create table if not exists updates_procesados (
  update_id  bigint primary key,
  creado     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Búsqueda difusa de alimentos (nombre + alias)
-- ---------------------------------------------------------------------
create or replace function buscar_alimentos(q text, limite int default 6)
returns setof alimentos
language sql stable as $$
  select a.*
  from alimentos a
  where a.nombre ilike '%' || q || '%'
     or similarity(a.nombre, q) > 0.2
     or exists (select 1 from unnest(a.alias) x where x ilike '%' || q || '%' or similarity(x, q) > 0.3)
  order by greatest(
             similarity(a.nombre, q),
             coalesce((select max(similarity(x, q)) from unnest(a.alias) x), 0)
           ) desc
  limit limite;
$$;

-- ---------------------------------------------------------------------
-- Seguridad: RLS activado sin políticas → solo el backend (service role)
-- puede leer/escribir. Nadie con la anon key ve nada.
-- ---------------------------------------------------------------------
alter table usuarios           enable row level security;
alter table alimentos          enable row level security;
alter table comidas            enable row level security;
alter table entrenamientos     enable row level security;
alter table despensa           enable row level security;
alter table mensajes           enable row level security;
alter table updates_procesados enable row level security;

-- ===== supabase/002_seed_alimentos.sql =====
-- =====================================================================
-- Seed: alimentos típicos + suplementos (valores aproximados c/100 g)
-- Son referencias orientativas: corregilas con las etiquetas de lo que
-- comprás vos. El bot agrega solo los que no encuentre (fuente=estimado_ia).
-- =====================================================================

insert into alimentos (nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
select nombre, alias::text[], categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g from (values
-- Proteínas
('Pechuga de pollo cocida',      '{pollo,pechuga}',              'alimento', 165, 31,   0,    3.6, '1 pechuga', 170),
('Milanesa de carne al horno',   '{milanesa,milanga}',           'alimento', 220, 22,   13,   9,   '1 milanesa', 130),
('Milanesa de carne frita',      '{milanesa frita}',             'alimento', 280, 20,   14,   16,  '1 milanesa', 130),
('Carne picada común cocida',    '{carne picada,picada}',        'alimento', 250, 26,   0,    15,  '1 porción', 150),
('Asado de tira cocido',         '{asado,tira de asado}',        'alimento', 300, 23,   0,    23,  '1 porción', 250),
('Huevo entero',                 '{huevo,huevos}',               'alimento', 143, 12.6, 0.7,  9.5, '1 unidad', 50),
('Atún al natural',              '{atun,lata de atun}',          'alimento', 116, 26,   0,    1,   '1 lata escurrida', 120),
('Queso cremoso',                '{queso,cremoso}',              'alimento', 300, 20,   2,    24,  '1 feta gruesa', 30),
('Yogur entero',                 '{yogur,yogurt}',               'alimento', 61,  3.5,  4.7,  3.3, '1 pote', 190),
-- Carbohidratos
('Arroz blanco cocido',          '{arroz}',                      'alimento', 130, 2.7,  28,   0.3, '1 taza', 160),
('Fideos cocidos',               '{fideos,pasta,tallarines}',    'alimento', 158, 5.8,  31,   0.9, '1 plato', 220),
('Papa hervida',                 '{papa,papas}',                 'alimento', 87,  1.9,  20,   0.1, '1 papa mediana', 170),
('Batata hervida',               '{batata}',                     'alimento', 76,  1.4,  18,   0.1, '1 batata mediana', 150),
('Avena',                        '{avena,copos de avena}',       'alimento', 389, 17,   66,   7,   '1/2 taza', 40),
('Pan francés',                  '{pan,flauta,mignon}',          'alimento', 280, 9,    56,   1.5, '1 mignon', 50),
('Lentejas cocidas',             '{lentejas}',                   'alimento', 116, 9,    20,   0.4, '1 taza', 200),
-- Comidas armadas
('Empanada de carne al horno',   '{empanada,empanadas}',         'alimento', 270, 11,   28,   13,  '1 unidad', 90),
('Pizza de muzzarella',          '{pizza,muzza}',                'alimento', 270, 11,   32,   10,  '1 porción', 120),
('Medialuna de manteca',         '{medialuna,medialunas,factura}','alimento', 410, 8,    45,   22,  '1 unidad', 40),
-- Frutas / verduras / grasas
('Banana',                       '{banana}',                     'alimento', 89,  1.1,  23,   0.3, '1 unidad', 120),
('Manzana',                      '{manzana}',                    'alimento', 52,  0.3,  14,   0.2, '1 unidad', 180),
('Tomate',                       '{tomate}',                     'alimento', 18,  0.9,  3.9,  0.2, '1 unidad', 120),
('Palta',                        '{palta,aguacate}',             'alimento', 160, 2,    8.5,  14.7,'1/2 palta', 80),
('Aceite de oliva',              '{aceite}',                     'alimento', 884, 0,    0,    100, '1 cucharada', 13),
('Dulce de leche',               '{ddl}',                        'alimento', 315, 7,    55,   7.5, '1 cucharada', 20),
('Mantequilla de maní',          '{mani,pasta de mani}',         'alimento', 588, 25,   20,   50,  '1 cucharada', 16),
-- Bebidas (c/100 ml)
('Leche entera',                 '{leche}',                      'bebida',   61,  3.2,  4.8,  3.3, '1 vaso', 250),
('Leche descremada',             '{leche descremada}',           'bebida',   35,  3.4,  5,    0.1, '1 vaso', 250),
('Coca-Cola común',              '{coca,gaseosa}',               'bebida',   42,  0,    10.6, 0,   '1 vaso', 250),
('Coca-Cola Zero',               '{coca zero,gaseosa zero}',     'bebida',   0,   0,    0,    0,   '1 vaso', 250),
('Mate sin azúcar',              '{mate,mates}',                 'bebida',   2,   0,    0.3,  0,   '1 termo', 500),
-- Suplementos
('Whey protein',                 '{whey,proteina en polvo,suero}','suplemento', 400, 78, 8,   6,   '1 scoop', 30),
('Caseína',                      '{caseina}',                    'suplemento', 370, 80,  6,   2,   '1 scoop', 30),
('Creatina monohidrato',         '{creatina}',                   'suplemento', 0,   0,   0,   0,   '1 dosis', 5),
('Ganador de peso',              '{gainer,ganador}',             'suplemento', 380, 15,  75,  3,   '1 servicio', 100),
('Barrita proteica',             '{barrita,barra proteica}',     'suplemento', 350, 30,  40,  9,   '1 barrita', 50)
) as v(nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
where not exists (select 1 from alimentos where fuente = 'manual');  -- no duplica si se corre de nuevo

-- ===== supabase/003_web.sql =====
-- =====================================================================
-- Acceso web: login con magic link (Supabase Auth) + RLS por email.
-- El mail se vincula desde Telegram con:  /web tu@mail.com
-- =====================================================================

alter table usuarios add column if not exists email text unique;

-- chat_ids del usuario logueado (security definer → evita recursión de RLS)
create or replace function mis_chat_ids()
returns setof bigint
language sql stable security definer
set search_path = public
as $$
  select chat_id from usuarios
  where email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- usuarios: ver y editar solo tu perfil
drop policy if exists usuarios_select on usuarios;
drop policy if exists usuarios_update on usuarios;
create policy usuarios_select on usuarios for select to authenticated
  using (chat_id in (select mis_chat_ids()));
create policy usuarios_update on usuarios for update to authenticated
  using (chat_id in (select mis_chat_ids()))
  with check (chat_id in (select mis_chat_ids()));

-- comidas / entrenamientos: ver y borrar lo tuyo (la carga se hace por el bot)
drop policy if exists comidas_select on comidas;
drop policy if exists comidas_delete on comidas;
create policy comidas_select on comidas for select to authenticated using (chat_id in (select mis_chat_ids()));
create policy comidas_delete on comidas for delete to authenticated using (chat_id in (select mis_chat_ids()));

drop policy if exists entrenos_select on entrenamientos;
drop policy if exists entrenos_delete on entrenamientos;
create policy entrenos_select on entrenamientos for select to authenticated using (chat_id in (select mis_chat_ids()));
create policy entrenos_delete on entrenamientos for delete to authenticated using (chat_id in (select mis_chat_ids()));

-- despensa: control total sobre lo tuyo
drop policy if exists despensa_all on despensa;
create policy despensa_all on despensa for all to authenticated
  using (chat_id in (select mis_chat_ids()))
  with check (chat_id in (select mis_chat_ids()));

-- alimentos: lectura para cualquier usuario logueado
drop policy if exists alimentos_select on alimentos;
create policy alimentos_select on alimentos for select to authenticated using (true);

-- Realtime: el dashboard se actualiza solo cuando cargás algo por Telegram
do $$
declare t text;
begin
  foreach t in array array['comidas','entrenamientos','despensa','usuarios'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===== supabase/004_codigo_barras.sql =====
-- =====================================================================
-- Escaneo de productos: código de barras en alimentos (datos de Open Food Facts)
-- =====================================================================

alter table alimentos add column if not exists codigo_barras text unique;
alter table alimentos add column if not exists marca text;

-- La web puede crear alimentos escaneados (solo con fuente 'off' y a tu nombre)
drop policy if exists alimentos_insert_off on alimentos;
create policy alimentos_insert_off on alimentos for insert to authenticated
  with check (fuente = 'off' and creado_por in (select mis_chat_ids()));
