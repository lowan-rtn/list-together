import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { session } from "@/lib/app-functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const actor = await session();
    if (!actor) throw redirect({ to: "/auth", search: { next: location.href } });
  },
  component: () => <Outlet />,
});
