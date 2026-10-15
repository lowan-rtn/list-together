import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rejoindre")({
  ssr: false,
  validateSearch: (value: Record<string, unknown>) => ({ code: typeof value.code === "string" ? value.code : "" }),
  beforeLoad: ({ search }) => {
    window.location.replace(`/auth?invite=${encodeURIComponent(search.code)}&next=%2F`);
  },
  component: () => null,
});
