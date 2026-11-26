create table if not exists public.shared_games (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Игровая сессия',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_game_members (
  game_code text not null references public.shared_games (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  character jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (game_code, user_id)
);

alter table public.shared_games enable row level security;
alter table public.shared_game_members enable row level security;
revoke all on public.shared_games, public.shared_game_members from anon, authenticated, public;

create or replace function public.create_shared_game(p_title text, p_snapshot jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  i integer;
begin
  if auth.uid() is null then raise exception 'Требуется войти в аккаунт.'; end if;
  for attempt in 1..20 loop
    new_code := '';
    for i in 1..5 loop
      new_code := new_code || substr(alphabet, (get_byte(decode(md5(random()::text || clock_timestamp()::text), 'hex'), i) % length(alphabet)) + 1, 1);
    end loop;
    begin
      insert into public.shared_games(code, owner_id, title, snapshot)
      values (new_code, auth.uid(), coalesce(nullif(trim(p_title), ''), 'Игровая сессия'), coalesce(p_snapshot, '{}'::jsonb));
      return new_code;
    exception when unique_violation then
      -- Retry if another session received the same five character code.
    end;
  end loop;
  raise exception 'Не удалось создать код. Попробуйте ещё раз.';
end;
$$;

create or replace function public.read_shared_game(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется войти в аккаунт.'; end if;
  select jsonb_build_object(
    'code', g.code,
    'owner_id', g.owner_id,
    'title', g.title,
    'snapshot', g.snapshot,
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'character', m.character)) from public.shared_game_members m where m.game_code = g.code), '[]'::jsonb)
  ) into result
  from public.shared_games g
  where g.code = upper(trim(p_code))
    and (g.owner_id = auth.uid() or exists (select 1 from public.shared_game_members m where m.game_code = g.code and m.user_id = auth.uid()));
  if result is null then raise exception 'Сессия не найдена или у вас нет доступа.'; end if;
  return result;
end;
$$;

create or replace function public.join_shared_game(p_code text, p_character jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare game_row public.shared_games%rowtype; next_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'Требуется войти в аккаунт.'; end if;
  select * into game_row from public.shared_games where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Сессия с таким кодом не найдена.'; end if;
  insert into public.shared_game_members(game_code, user_id, character)
  values (game_row.code, auth.uid(), coalesce(p_character, '{}'::jsonb))
  on conflict (game_code, user_id) do update set character = excluded.character;
  next_snapshot := game_row.snapshot;
  if coalesce(p_character->>'characterId', '') <> '' then
    next_snapshot := game_row.snapshot;
    next_snapshot := jsonb_set(next_snapshot, '{dnd-party}',
      coalesce((select jsonb_agg(entry.value)
       from jsonb_array_elements(coalesce(next_snapshot->'dnd-party', '[]'::jsonb)) as entry(value)
       where entry.value->>'characterId' <> p_character->>'characterId'), '[]'::jsonb) || jsonb_build_array(p_character), true);
    update public.shared_games set snapshot = next_snapshot, updated_at = now() where code = game_row.code;
  end if;
  return jsonb_build_object('code', game_row.code, 'owner_id', game_row.owner_id, 'title', game_row.title, 'snapshot', next_snapshot);
end;
$$;

create or replace function public.update_shared_game(p_code text, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Требуется войти в аккаунт.'; end if;
  update public.shared_games g set snapshot = coalesce(p_snapshot, '{}'::jsonb), updated_at = now()
  where g.code = upper(trim(p_code))
    and (g.owner_id = auth.uid() or exists (select 1 from public.shared_game_members m where m.game_code = g.code and m.user_id = auth.uid()));
  if not found then raise exception 'Сессия не найдена или у вас нет доступа.'; end if;
end;
$$;

revoke all on function public.create_shared_game(text, jsonb) from public, anon;
revoke all on function public.read_shared_game(text) from public, anon;
revoke all on function public.join_shared_game(text, jsonb) from public, anon;
revoke all on function public.update_shared_game(text, jsonb) from public, anon;
grant execute on function public.create_shared_game(text, jsonb) to authenticated;
grant execute on function public.read_shared_game(text) to authenticated;
grant execute on function public.join_shared_game(text, jsonb) to authenticated;
grant execute on function public.update_shared_game(text, jsonb) to authenticated;

create or replace function public.can_access_shared_game(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shared_games g
    where g.code = upper(trim(p_code))
      and (g.owner_id = auth.uid() or exists (select 1 from public.shared_game_members m where m.game_code = g.code and m.user_id = auth.uid()))
  );
$$;
revoke all on function public.can_access_shared_game(text) from public, anon;
grant execute on function public.can_access_shared_game(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dnd-media', 'dnd-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "DND media readable by owner or game members" on storage.objects;
create policy "DND media readable by owner or game members"
on storage.objects for select to authenticated
using (
  bucket_id = 'dnd-media' and (
    (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text
    or (storage.foldername(name))[1] = 'games' and public.can_access_shared_game((storage.foldername(name))[2])
  )
);

drop policy if exists "DND media upload to own or joined game folders" on storage.objects;
create policy "DND media upload to own or joined game folders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dnd-media' and (
    (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text
    or (storage.foldername(name))[1] = 'games' and public.can_access_shared_game((storage.foldername(name))[2])
  )
);

drop policy if exists "DND media deletion by owner or game members" on storage.objects;
create policy "DND media deletion by owner or game members"
on storage.objects for delete to authenticated
using (
  bucket_id = 'dnd-media' and (
    (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text
    or (storage.foldername(name))[1] = 'games' and public.can_access_shared_game((storage.foldername(name))[2])
  )
);

