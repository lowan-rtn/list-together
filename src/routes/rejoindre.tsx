import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rejoindre")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s["code"] === "string" ? s["code"] : "" }),
  head: () => ({
    meta: [
      { title: "Rejoindre la liste — Panier" },
      { name: "description", content: "Vous êtes invité à participer à une liste de courses partagée." },
      { property: "og:title", content: "Rejoindre la liste — Panier" },
      { property: "og:description", content: "Participez à la liste de courses en un geste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user)); }, []);

  const join = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("join_list", { _code: code });
    setBusy(false);
    if (error) return void toast.error("Lien d'invitation invalide");
    await qc.invalidateQueries({ queryKey: ["list"] });
    toast.success("Vous avez rejoint la liste !");
    nav({ to: "/" });
  };

  const next = `/rejoindre?code=${encodeURIComponent(code)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="text-5xl">🧺</p>
      <p className="mt-4 text-sm text-muted-foreground">Vous êtes invité à rejoindre</p>
      <h1 className="text-3xl font-bold">une liste de courses partagée</h1>
      {!code ? (
        <p className="mt-6 text-muted-foreground">Ce lien d'invitation est incomplet.</p>
      ) : signedIn === null ? null : signedIn ? (
        <button disabled={busy} onClick={join} className="tap mt-8 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">Rejoindre la liste</button>
      ) : (
        <Link to="/auth" search={{ next }} className="tap mt-8 grid h-12 w-full place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">Se connecter ou créer un compte</Link>
      )}
    </main>
  );
}
