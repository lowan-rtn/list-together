import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { addItem, archiveItem, listData, setItemQuantity, setItemTag } from "@/lib/app-functions";

export const COLORS = ["green", "teal", "amber", "rose", "slate", "sky", "orange", "violet"] as const;
export type Tag = { id: string; key: string | null; name: string; color: string; rank: number };
export type Item = { id: string; name: string; qty: string | null; tag_id: string; updated_at: string };
export type HistoryEvent = { id: string; user_id: string | null; user_name: string | null; item_name: string; type: string; from_label: string | null; to_label: string | null; created_at: string };
export type Member = { id: string; display_name: string };
export type ListData = { list: { id: string; name: string; invite_code: string; created_by: string }; isOwner: boolean; tags: Tag[]; items: Item[]; events: HistoryEvent[]; members: Member[]; me: string };

export const listQuery = queryOptions({ queryKey: ["list"], queryFn: () => listData() as Promise<ListData> });
export function useList() { return useSuspenseQuery(listQuery).data; }
export function sortedItems(d: ListData) { const rank = (tag: string) => d.tags.find((value) => value.id === tag)?.rank ?? 5; return [...d.items].sort((a, b) => rank(a.tag_id) - rank(b.tag_id) || b.updated_at.localeCompare(a.updated_at)); }
export const tagByKey = (d: ListData, key: string) => d.tags.find((tag) => tag.key === key);

export function useActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["list"] });
  const patchCache = (fn: (data: ListData) => ListData) => { const current = qc.getQueryData<ListData>(["list"]); if (current) qc.setQueryData(["list"], fn(current)); };
  return {
    async addItem(_listId: string, _tagId: string, name: string, qty?: string) { if (!name.trim()) throw new Error("Le nom est requis."); await addItem({ data: { name: name.trim(), qty } }); await refresh(); },
    async setTag(itemId: string, tagId: string) { patchCache((data) => ({ ...data, items: data.items.map((item) => item.id === itemId ? { ...item, tag_id: tagId, updated_at: new Date().toISOString() } : item) })); await setItemTag({ data: { itemId, tagId } }); await refresh(); },
    async setQty(itemId: string, qty: string) { patchCache((data) => ({ ...data, items: data.items.map((item) => item.id === itemId ? { ...item, qty: qty || null } : item) })); await setItemQuantity({ data: { itemId, qty } }); await refresh(); },
    async deleteItem(itemId: string) { await archiveItem({ data: { itemId } }); await refresh(); },
  };
}
