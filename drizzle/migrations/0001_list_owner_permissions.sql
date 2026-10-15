create or replace function public.is_owner(_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = _list and created_by = auth.uid())
$$;

drop policy "lists member update" on public.lists;
create policy "lists owner update" on public.lists for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

drop policy "tags insert" on public.tags;
drop policy "tags update" on public.tags;
create policy "tags owner insert" on public.tags for insert to authenticated with check (public.is_owner(list_id));
create policy "tags owner update" on public.tags for update to authenticated using (public.is_owner(list_id)) with check (public.is_owner(list_id));

grant delete on public.items to authenticated;
create policy "items owner delete" on public.items for delete to authenticated using (public.is_owner(list_id));

create or replace function public.items_log_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.events (list_id, user_id, user_name, item_name, type)
  values (old.list_id, auth.uid(), (select display_name from public.profiles where id = auth.uid()), old.name, 'delete');
  return old;
end $$;
create trigger items_log_delete before delete on public.items for each row execute function public.items_log_delete();