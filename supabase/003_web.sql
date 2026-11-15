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
