import { useEffect } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const COLORS = ["green", "teal", "amber", "rose", "slate", "sky", "orange", "violet"] as const;

export type Tag = { id: string; key: string | null; name: string; color: string; rank: number };
export type Item = { id: string; name: string; qty: string | null; tag_id: string; updated_at: string };
export type HistoryEvent = {
  id: string; user_id: string | null; user_name: string | null; item_name: string;
  type: string; from_label: string | null; to_label: string | null; created_at: string;
};
export type Member = { id: string; display_name: string };
export type ListData = {
  list: { id: string; name: string; invite_code: string; created_by: string };
  isOwner: boolean;
  tags: Tag[]; items: Item[]; events: HistoryEvent[]; members: Member[]; me: string;
};

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

async function fetchList(): Promise<ListData> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Non connecté");
  const listId = must(await supabase.rpc("ensure_my_list")) as string;
  const [list, tags, items, events, mem] = await Promise.all([
    supabase.from("lists").select("id,name,invite_code,created_by").eq("id", listId).single(),
    supabase.from("tags").select("id,key,name,color,rank").eq("list_id", listId).order("rank").order("created_at"),
    supabase.from("items").select("id,name,qty,tag_id,updated_at").eq("list_id", listId),
    supabase.from("events").select("*").eq("list_id", listId).order("created_at", { ascending: false }).limit(300),
    supabase.from("list_members").select("user_id").eq("list_id", listId),
  ]);
  const ids = must(mem).map((m) => m.user_id);
  const profiles = must(await supabase.from("profiles").select("id,display_name").in("id", ids));
  return {
    list: must(list), isOwner: must(list).created_by === u.user.id, tags: must(tags), items: must(items), events: must(events) as HistoryEvent[],
    members: profiles, me: u.user.id,
  };
}

export const listQuery = queryOptions({ queryKey: ["list"], queryFn: fetchList });

export function useList() {
  const qc = useQueryClient();
  const q = useSuspenseQuery(listQuery);
  const listId = q.data.list.id;
  useEffect(() => {
    const ch = supabase
      .channel(`list-${listId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `list_id=eq.${listId}` }, () => qc.invalidateQueries({ queryKey: ["list"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "tags", filter: `list_id=eq.${listId}` }, () => qc.invalidateQueries({ queryKey: ["list"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `id=eq.${listId}` }, () => qc.invalidateQueries({ queryKey: ["list"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [listId, qc]);
  return q.data;
}

export function sortedItems(d: ListData) {
  const rank = (t: string) => d.tags.find((x) => x.id === t)?.rank ?? 5;
  return [...d.items].sort((a, b) => rank(a.tag_id) - rank(b.tag_id) || b.updated_at.localeCompare(a.updated_at));
}

export const tagByKey = (d: ListData, key: string) => d.tags.find((t) => t.key === key);

/** Shared mutations used by the UI and the browser agent tools. */
export function useActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["list"] });
  const patchCache = (fn: (d: ListData) => ListData) => {
    const cur = qc.getQueryData<ListData>(["list"]);
    if (cur) qc.setQueryData(["list"], fn(cur));
  };
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    await refresh();
    if (error) throw new Error(error.message);
  };
  return {
    async addItem(listId: string, tagId: string, name: string, qty?: string) {
      if (typeof name !== "string" || !name.trim()) throw new Error("Le nom est requis.");
      await run(supabase.from("items").insert({ list_id: listId, tag_id: tagId, name: name.trim(), qty: qty?.trim() || null }));
    },
    async setTag(itemId: string, tagId: string) {
      patchCache((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, tag_id: tagId, updated_at: new Date().toISOString() } : i)) }));
      await run(supabase.from("items").update({ tag_id: tagId }).eq("id", itemId));
    },
    async setQty(itemId: string, qty: string) {
      patchCache((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, qty: qty || null } : i)) }));
      await run(supabase.from("items").update({ qty: qty.trim() || null }).eq("id", itemId));
    },
    async deleteItem(itemId: string) {
      patchCache((d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));
      await run(supabase.from("items").delete().eq("id", itemId));
    },
    async setListName(listId: string, name: string) {
      if (!name.trim()) return;
      await run(supabase.from("lists").update({ name: name.trim() }).eq("id", listId));
    },
    async addTag(listId: string, name: string, color: string) {
      await run(supabase.from("tags").insert({ list_id: listId, name: name.trim(), color, rank: 5 }));
    },
    async updateTag(tagId: string, patch: { name?: string; color?: string }) {
      await run(supabase.from("tags").update(patch).eq("id", tagId));
    },
    async setMyName(userId: string, name: string) {
      if (!name.trim()) return;
      await run(supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId));
    },
  };
}
