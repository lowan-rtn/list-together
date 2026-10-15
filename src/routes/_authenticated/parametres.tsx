import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COLORS, listQuery, useActions, useList, type Tag } from "@/lib/list-data";
import { Screen, TAG_BG } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/parametres")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  head: () => ({
    meta: [
      { title: "Paramètres — Panier" },
      { name: "description", content: "Nom de la liste, étiquettes et membres." },
      { property: "og:title", content: "Paramètres — Panier" },
      { property: "og:description", content: "Personnalisez la liste et ses étiquettes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const card = "rounded-2xl bg-card p-4 ring-1 ring-border";
const field = "h-11 w-full rounded-xl bg-muted px-3 text-base outline-none focus:ring-2 focus:ring-ring";
const err = (e: Error) => toast.error(e.message);

function SettingsPage() {
  const d = useList();
  const a = useActions();
  const qc = useQueryClient();
  const nav = useNavigate();
  const me = d.members.find((m) => m.id === d.me);
  const [listName, setListName] = useState(d.list.name);
  const [myName, setMyName] = useState(me?.display_name ?? "");
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState<string>("teal");

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", search: { next: "/" }, replace: true });
  };

  return (
    <Screen title="Paramètres">
      <section className="space-y-6">
        <div className={card}>
          <label className="text-sm font-semibold text-muted-foreground">Nom de la liste</label>
          <input value={listName} onChange={(e) => setListName(e.target.value)} onBlur={() => a.setListName(d.list.id, listName).catch(err)} disabled={!d.isOwner} className={`mt-2 ${field} disabled:opacity-60`} />
          <label className="mt-4 block text-sm font-semibold text-muted-foreground">Votre nom affiché</label>
          <input value={myName} onChange={(e) => setMyName(e.target.value)} onBlur={() => a.setMyName(d.me, myName).catch(err)} className={`mt-2 ${field}`} />
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold">Étiquettes</h2>
          <ul className="mt-3 space-y-4">
            {d.tags.map((t) => <TagRow key={t.id} tag={t} canEdit={d.isOwner} />)}
          </ul>
          {!d.isOwner && <p className="mt-4 text-sm text-muted-foreground">Seul le propriétaire de la liste peut modifier son nom et ses étiquettes.</p>}
          {d.isOwner && <form className="mt-5 space-y-2 border-t pt-4" onSubmit={async (e) => {
            e.preventDefault();
            if (!newTag.trim()) return;
            try { await a.addTag(d.list.id, newTag, newColor); toast.success("Étiquette ajoutée"); setNewTag(""); } catch (x) { err(x as Error); }
          }}>
            <div className="flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nouvelle étiquette" className={`min-w-0 flex-1 ${field}`} />
              <button aria-label="Ajouter l'étiquette" className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></button>
            </div>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </form>}
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold">Membres</h2>
          <ul className="mt-3 space-y-2">
            {d.members.map((m) => (
              <li key={m.id} className="flex h-11 items-center justify-between rounded-xl px-3 ring-1 ring-border">
                <span className="font-medium">{m.display_name}</span>
                <span className="text-xs text-muted-foreground">{[m.id === d.list.created_by && "Propriétaire", m.id === d.me && "Vous"].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>

        <button onClick={signOut} className="tap h-12 w-full rounded-xl font-medium text-destructive ring-1 ring-border">Se déconnecter</button>
      </section>
    </Screen>
  );
}

function TagRow({ tag, canEdit }: { tag: Tag; canEdit: boolean }) {
  const a = useActions();
  const [name, setName] = useState(tag.name);
  return (
    <li className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== tag.name) a.updateTag(tag.id, { name: name.trim() }).catch(err); }} disabled={!canEdit} className={`${field} disabled:opacity-60`} />
      {canEdit && <ColorPicker value={tag.color} onChange={(c) => a.updateTag(tag.id, { color: c }).catch(err)} />}
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2">
      {COLORS.map((c) => (
        <button type="button" key={c} aria-label={c} onClick={() => onChange(c)} className={`tap h-8 w-8 rounded-full ${TAG_BG[c]} ${value === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} />
      ))}
    </div>
  );
}
