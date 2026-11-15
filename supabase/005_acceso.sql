-- Acceso por aprobación (sin redeploys): el admin aprueba usuarios desde Telegram
alter table usuarios add column if not exists habilitado boolean not null default false;
alter table usuarios add column if not exists es_admin boolean not null default false;
alter table usuarios add column if not exists solicitado_en timestamptz;
alter table usuarios add column if not exists username text;
