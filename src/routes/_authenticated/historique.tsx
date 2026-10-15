import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { listQuery, useList } from "@/lib/list-data";
import { Screen, TAG_SOFT } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/historique")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  head: () => ({
    meta: [
      { title: "Historique — Panier" },
      { name: "description", content: "Toutes les modifications de la liste de courses partagée." },
      { property: "og:title", content: "Historique — Panier" },
      { property: "og:description", content: "Qui a fait quoi, et quand, sur la liste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function HistoryPage() {
  const d = useList();
  const color = (name: string | null) => d.tags.find((t) => t.name === name)?.color ?? "slate";

  return (
    <Screen title="Historique">
      {d.events.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">Aucune activité pour l'instant.</p>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {d.events.map((e) => (
            <li key={e.id} className="relative animate-in fade-in duration-300">
              <span className="absolute -left-[1.6rem] top-4 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{e.user_name ?? "Quelqu'un"}</span>
                  <time>{fmt.format(new Date(e.created_at))}</time>
                </div>
                <p className="mt-1.5 font-medium">{e.item_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {e.type === "add" && <span className="text-muted-foreground">Ajouté à la liste</span>}
                  {e.type === "delete" && <span className="text-destructive">Supprimé de la liste</span>}
                  {e.type === "tag" && (
                    <>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_SOFT[color(e.from_label)]}`}>{e.from_label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_SOFT[color(e.to_label)]}`}>{e.to_label}</span>
                    </>
                  )}
                  {(e.type === "qty" || e.type === "rename") && (
                    <span className="text-muted-foreground">
                      {e.type === "qty" ? "Quantité" : "Renommé"} : {e.from_label} → <span className="text-foreground">{e.to_label}</span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Screen>
  );
}
