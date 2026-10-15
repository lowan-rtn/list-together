import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logout } from "@/lib/app-functions";
import { listQuery, useList } from "@/lib/list-data";
import { Screen } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/parametres")({ loader: ({ context }) => context.queryClient.ensureQueryData(listQuery), component: SettingsPage });

function SettingsPage() {
  const data = useList();
  const client = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => { await logout(); client.clear(); toast.success("Déconnecté"); navigate({ to: "/auth", replace: true }); };
  return <Screen title="Paramètres"><section className="space-y-5"><div className="rounded-2xl bg-card p-4 ring-1 ring-border"><p className="text-sm text-muted-foreground">Vous êtes connecté en tant que</p><p className="mt-1 text-lg font-semibold">{data.members.find((member) => member.id === data.me)?.display_name ?? "Invité"}{data.isOwner ? " (propriétaire)" : ""}</p></div><div className="rounded-2xl bg-card p-4 ring-1 ring-border"><h2 className="font-semibold">Liste partagée</h2><p className="mt-2 text-sm text-muted-foreground">Les étiquettes, les descriptions et les liens produits arriveront juste après cette première migration D1. Les règles de propriété et l'historique sont déjà appliqués côté serveur.</p></div><button onClick={signOut} className="tap h-12 w-full rounded-xl font-medium text-destructive ring-1 ring-border">Se déconnecter</button></section></Screen>;
}
