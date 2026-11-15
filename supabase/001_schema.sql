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
