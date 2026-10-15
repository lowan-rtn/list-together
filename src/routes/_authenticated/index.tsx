import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, History, Plus, Settings, Share2, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWebMCP } from "use-webmcp-tool";
import { listQuery, sortedItems, tagByKey, useActions, useList, type Item, type ListData } from "@/lib/list-data";
import { TAG_BG, TAG_SOFT } from "@/components/ui-bits";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  head: () => ({
    meta: [
      { title: "Panier — Liste de courses partagée" },
      { name: "description", content: "Une liste de courses unique, partagée et ultra simple à utiliser au supermarché." },
      { property: "og:title", content: "Panier — Liste de courses partagée" },
      { property: "og:description", content: "Une liste de courses unique, partagée et ultra simple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const d = useList();
  const a = useActions();
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const items = sortedItems(d);
  const buy = tagByKey(d, "buy") ?? d.tags[0];
  const done = tagByKey(d, "done");
  const toBuy = d.items.filter((i) => i.tag_id === buy?.id).length;
  const me = d.members.find((m) => m.id === d.me);

  const add = async (v: string, qty?: string) => {
    if (!buy) throw new Error("Aucune étiquette disponible.");
    await a.addItem(d.list.id, buy.id, v, qty);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    setName("");
    try { await add(v); toast.success(`« ${v} » ajouté`); }
    catch (err) { setName(v); toast.error((err as Error).message); }
  };

  const share = async () => {
    const url = `${window.location.origin}/rejoindre?code=${d.list.invite_code}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    toast("Lien de partage copié", { description: url });
  };

  useAgentTools(d, add, a.setTag);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] font-bold leading-tight">{d.list.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toBuy === 0 ? "Rien à acheter 🎉" : `${toBuy} article${toBuy > 1 ? "s" : ""} à acheter`}
            {me && <> · {me.display_name}{d.isOwner && " (propriétaire)"}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Link to="/historique" aria-label="Historique" className="tap grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"><History className="h-5 w-5" /></Link>
          <Link to="/parametres" aria-label="Paramètres" className="tap grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"><Settings className="h-5 w-5" /></Link>
          <button onClick={share} aria-label="Partager" className="tap ml-1 flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground sm:px-4">
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Partager</span>
          </button>
        </div>
      </header>

      <form onSubmit={submit} className="sticky top-2 z-10 mt-5 flex gap-2 rounded-2xl bg-card p-1.5 shadow-[0_6px_24px_-12px_oklch(0.3_0.05_160/0.35)] ring-1 ring-border">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajouter un article…" enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground" />
        <button aria-label="Ajouter" disabled={!name.trim()} className="tap grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Plus className="h-6 w-6" /></button>
      </form>

      {items.length === 0 ? (
        <div className="mt-20 text-center text-muted-foreground">
          <p className="text-4xl">🧺</p>
          <p className="mt-3 font-medium text-foreground">La liste est vide</p>
          <p className="text-sm">Ajoutez votre premier article ci-dessus.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((it, idx) => {
            const prev = items[idx - 1];
            const sep = done && prev && prev.tag_id !== done.id && it.tag_id === done.id;
            return (
              <li key={it.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                {sep && <p className="px-1 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dans le panier</p>}
                <Row d={d} item={it} open={open === it.id} onToggle={() => setOpen(open === it.id ? null : it.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function useAgentTools(d: ListData, add: (n: string, q?: string) => Promise<void>, setTag: (i: string, t: string) => Promise<void>) {
  useWebMCP({
    name: "list_items",
    description: "List the shopping items shown on screen with their id, quantity and current tag.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("list_items", () => {
      const rows = sortedItems(d).map((i) => `${i.id}: ${i.name}${i.qty ? ` (${i.qty})` : ""} — ${d.tags.find((t) => t.id === i.tag_id)?.name ?? "?"}`);
      const tags = d.tags.map((t) => `${t.id}: ${t.name}`).join("\n");
      return `${rows.length ? rows.join("\n") : "La liste est vide."}\n\nÉtiquettes:\n${tags}`;
    }),
  });
  useWebMCP({
    name: "add_item",
    description: "Add an item to the shopping list with the 'À acheter' tag.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Item name." }, qty: { type: "string", description: "Optional quantity, e.g. '2 L'." } },
      required: ["name"],
    },
    execute: ({ name, qty }: { name: unknown; qty?: unknown }) => runWebMCPTool("add_item", async () => {
      if (typeof name !== "string" || !name.trim()) throw new Error("name must be a non-empty string.");
      if (qty !== undefined && typeof qty !== "string") throw new Error("qty must be a string.");
      await add(name, qty);
      return `Ajouté « ${name.trim()} ».`;
    }),
  });
  useWebMCP({
    name: "set_item_tag",
    description: "Change an item's tag (e.g. mark it as bought). Use ids from list_items.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string", description: "Item id." }, tag_id: { type: "string", description: "Tag id." } },
      required: ["item_id", "tag_id"],
    },
    execute: ({ item_id, tag_id }: { item_id: unknown; tag_id: unknown }) => runWebMCPTool("set_item_tag", async () => {
      const item = d.items.find((i) => i.id === item_id);
      const tag = d.tags.find((t) => t.id === tag_id);
      if (!item) throw new Error("Unknown item_id.");
      if (!tag) throw new Error("Unknown tag_id.");
      await setTag(item.id, tag.id);
      return `« ${item.name} » → ${tag.name}.`;
    }),
  });
}

function Row({ d, item, open, onToggle }: { d: ListData; item: Item; open: boolean; onToggle: () => void }) {
  const a = useActions();
  const tag = d.tags.find((t) => t.id === item.tag_id) ?? d.tags[0];
  const doneTag = tagByKey(d, "done");
  const buyTag = tagByKey(d, "buy");
  const done = item.tag_id === doneTag?.id;
  const muted = done || tag?.key === "na";
  const set = (t: string) => a.setTag(item.id, t).catch((e: Error) => toast.error(e.message));

  return (
    <div className={`rounded-2xl bg-card ring-1 ring-border transition-all ${open ? "shadow-md" : ""}`}>
      <div className="flex items-center gap-1 p-1.5">
        <button aria-label={done ? "Remettre à acheter" : "Marquer comme acheté"}
          onClick={() => { const t = done ? buyTag : doneTag; if (t) set(t.id); }}
          className="tap grid h-12 w-12 shrink-0 place-items-center">
          <span className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors ${done ? "border-tag-green bg-tag-green text-primary-foreground" : "border-muted-foreground/40"}`}>
            {done && <Check className="h-4 w-4" strokeWidth={3} />}
          </span>
        </button>
        <button onClick={onToggle} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 pr-2 text-left">
          <span className={`min-w-0 flex-1 truncate text-[1.05rem] ${muted ? "text-muted-foreground" : "font-medium"} ${done ? "line-through" : ""}`}>
            {item.name}
            {item.qty && <span className="ml-2 text-sm font-normal text-muted-foreground">× {item.qty}</span>}
          </span>
          {tag && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_SOFT[tag.color] ?? TAG_SOFT["slate"]}`}>{tag.name}</span>}
        </button>
      </div>
      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-3 border-t px-3 pb-3 pt-3 duration-200">
          <div className="flex flex-wrap gap-2">
            {d.tags.map((t) => (
              <button key={t.id} onClick={() => { set(t.id); onToggle(); }}
                className={`tap flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ${t.id === item.tag_id ? "bg-foreground text-background ring-foreground" : "ring-border hover:bg-muted"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${TAG_BG[t.color] ?? TAG_BG["slate"]}`} /> {t.name}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <QtyEditor item={item} />
            {d.isOwner && (
              <button aria-label="Supprimer l'article" onClick={() => { if (confirm(`Supprimer « ${item.name} » ?`)) a.deleteItem(item.id).then(() => toast.success("Article supprimé")).catch((e: Error) => toast.error(e.message)); }}
                className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QtyEditor({ item }: { item: Item }) {
  const a = useActions();
  const [v, setV] = useState(item.qty ?? "");
  const num = /^\d+$/.test(v) ? parseInt(v) : null;
  const commit = (x: string) => { setV(x); a.setQty(item.id, x).catch((e: Error) => toast.error(e.message)); };
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Quantité</span>
      <button aria-label="Moins" onClick={() => commit(String(Math.max(1, (num ?? 2) - 1)))} className="tap grid h-10 w-10 place-items-center rounded-full bg-muted"><Minus className="h-4 w-4" /></button>
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim() !== (item.qty ?? "")) commit(v); }} placeholder="—"
        className="h-10 w-20 rounded-xl bg-muted text-center text-base outline-none focus:ring-2 focus:ring-ring" />
      <button aria-label="Plus" onClick={() => commit(String((num ?? 0) + 1))} className="tap grid h-10 w-10 place-items-center rounded-full bg-muted"><Plus className="h-4 w-4" /></button>
    </div>
  );
}
