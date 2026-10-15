import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: oauthReturnPath(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Connexion — Panier" },
      { name: "description", content: "Connectez-vous pour retrouver votre liste de courses partagée." },
      { property: "og:title", content: "Connexion — Panier" },
      { property: "og:description", content: "Retrouvez votre liste de courses partagée." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input = "h-12 w-full rounded-xl bg-muted px-3 text-base outline-none focus:ring-2 focus:ring-ring";

function AuthPage() {
  const { next } = Route.useSearch();
    const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const go = () => { window.location.assign(next); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) go(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) return void toast.error("Email ou mot de passe incorrect");
      go();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password: pw,
        options: { data: { display_name: name.trim() }, emailRedirectTo: new URL(next, window.location.origin).href },
      });
      setBusy(false);
      if (error) return void toast.error(error.message);
      if (data.session) go(); else setSent(true);
    }
  };

  const google = async () => {
    const back = new URL("/auth", window.location.origin);
    back.searchParams.set("next", next);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: back.href },
    });
    if (error || !data.url) return void toast.error("Connexion Google impossible");
    window.location.assign(data.url);
  };

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
        <p className="text-5xl">📬</p>
        <h1 className="mt-4 text-2xl font-bold">Vérifiez vos emails</h1>
        <p className="mt-2 text-muted-foreground">Cliquez sur le lien envoyé à {email} pour activer votre compte.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="text-5xl">🧺</p>
      <h1 className="mt-4 text-3xl font-bold">Panier</h1>
      <p className="mt-1 text-muted-foreground">La liste de courses de toute la maison.</p>

      <div className="mt-8 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-10 rounded-lg transition-colors ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            {m === "login" ? "Se connecter" : "Créer un compte"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === "signup" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom affiché (ex. Camille)" className={input} />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" autoComplete="email" className={input} />
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required minLength={6} placeholder="Mot de passe" autoComplete={mode === "signup" ? "new-password" : "current-password"} className={input} />
        <button disabled={busy} className="tap h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
      <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
      <button onClick={google} className="tap h-12 w-full rounded-xl bg-card font-medium ring-1 ring-border">Continuer avec Google</button>
    </main>
  );
}
