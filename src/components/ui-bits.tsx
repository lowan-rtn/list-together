import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export const TAG_BG: Record<string, string> = {
  green: "bg-tag-green", teal: "bg-tag-teal", amber: "bg-tag-amber", rose: "bg-tag-rose",
  slate: "bg-tag-slate", sky: "bg-tag-sky", orange: "bg-tag-orange", violet: "bg-tag-violet",
};
export const TAG_SOFT: Record<string, string> = {
  green: "bg-tag-green/15 text-tag-green", teal: "bg-tag-teal/15 text-tag-teal",
  amber: "bg-tag-amber/20 text-tag-amber", rose: "bg-tag-rose/15 text-tag-rose",
  slate: "bg-tag-slate/15 text-tag-slate", sky: "bg-tag-sky/15 text-tag-sky",
  orange: "bg-tag-orange/15 text-tag-orange", violet: "bg-tag-violet/15 text-tag-violet",
};

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center gap-2">
        <Link to="/" aria-label="Retour" className="tap -ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>
      {children}
    </div>
  );
}
