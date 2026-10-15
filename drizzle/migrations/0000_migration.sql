create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Membre',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Courses de la maison',
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, update on public.lists to authenticated;
grant all on public.lists to service_role;
alter table public.lists enable row level security;

create table public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
grant select on public.list_members to authenticated;
grant all on public.list_members to service_role;
alter table public.list_members enable row level security;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  key text,
  name text not null,
  color text not null default 'slate',
  rank int not null default 5,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.tags to authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  qty text,
  tag_id uuid not null references public.tags(id),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid,
  user_name text,
  item_name text not null,
  type text not null,
  from_label text,
  to_label text,
  created_at timestamptz not null default now()
);
grant select on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;

create or replace function public.is_member(_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = _list and user_id = auth.uid())
$$;

create policy "profiles readable by self and list mates" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.list_members a join public.list_members b on a.list_id = b.list_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "lists member read" on public.lists for select to authenticated using (public.is_member(id));
create policy "lists member update" on public.lists for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy "members read" on public.list_members for select to authenticated using (public.is_member(list_id));
create policy "tags read" on public.tags for select to authenticated using (public.is_member(list_id));
create policy "tags insert" on public.tags for insert to authenticated with check (public.is_member(list_id));
create policy "tags update" on public.tags for update to authenticated using (public.is_member(list_id)) with check (public.is_member(list_id));
create policy "items read" on public.items for select to authenticated using (public.is_member(list_id));
create policy "items insert" on public.items for insert to authenticated with check (public.is_member(list_id) and exists (select 1 from public.tags t where t.id = tag_id and t.list_id = items.list_id));
create policy "items update" on public.items for update to authenticated using (public.is_member(list_id)) with check (public.is_member(list_id) and exists (select 1 from public.tags t where t.id = tag_id and t.list_id = items.list_id));
create policy "events read" on public.events for select to authenticated using (public.is_member(list_id));

-- profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'Membre'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- get or create the caller's list
create or replace function public.ensure_my_list() returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _list uuid;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select list_id into _list from public.list_members where user_id = _uid order by joined_at desc limit 1;
  if _list is not null then return _list; end if;
  insert into public.lists (created_by) values (_uid) returning id into _list;
  insert into public.list_members (list_id, user_id) values (_list, _uid);
  insert into public.tags (list_id, key, name, color, rank) values
    (_list, 'buy', 'À acheter', 'sky', 0),
    (_list, 'check', 'À vérifier', 'amber', 1),
    (_list, 'opt', 'Facultatif', 'violet', 2),
    (_list, 'pricey', 'Trop cher', 'orange', 3),
    (_list, 'na', 'Indisponible', 'slate', 4),
    (_list, 'done', 'Acheté', 'green', 9);
  return _list;
end $$;

create or replace function public.join_list(_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _list uuid;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select id into _list from public.lists where invite_code = _code;
  if _list is null then raise exception 'invalid invite code'; end if;
  insert into public.list_members (list_id, user_id) values (_list, _uid)
    on conflict (list_id, user_id) do update set joined_at = now();
  return _list;
end $$;

revoke execute on function public.ensure_my_list() from public, anon;
revoke execute on function public.join_list(text) from public, anon;
grant execute on function public.ensure_my_list() to authenticated;
grant execute on function public.join_list(text) to authenticated;

-- item stamps + history
create or replace function public.items_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' or new.tag_id is distinct from old.tag_id then new.updated_at := now(); end if;
  if tg_op = 'UPDATE' then new.list_id := old.list_id; new.created_at := old.created_at; end if;
  return new;
end $$;
create trigger items_stamp before insert or update on public.items for each row execute function public.items_stamp();

create or replace function public.items_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare _name text;
begin
  select display_name into _name from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.events (list_id, user_id, user_name, item_name, type) values (new.list_id, auth.uid(), _name, new.name, 'add');
    return new;
  end if;
  if new.tag_id is distinct from old.tag_id then
    insert into public.events (list_id, user_id, user_name, item_name, type, from_label, to_label)
    values (new.list_id, auth.uid(), _name, new.name, 'tag',
      (select name from public.tags where id = old.tag_id), (select name from public.tags where id = new.tag_id));
  end if;
  if new.qty is distinct from old.qty then
    insert into public.events (list_id, user_id, user_name, item_name, type, from_label, to_label)
    values (new.list_id, auth.uid(), _name, new.name, 'qty', coalesce(old.qty, '—'), coalesce(new.qty, '—'));
  end if;
  if new.name is distinct from old.name then
    insert into public.events (list_id, user_id, user_name, item_name, type, from_label, to_label)
    values (new.list_id, auth.uid(), _name, new.name, 'rename', old.name, new.name);
  end if;
  return new;
end $$;
create trigger items_log after insert or update on public.items for each row execute function public.items_log();

alter publication supabase_realtime add table public.items, public.events, public.tags, public.lists;