import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { player, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!player) navigate({ to: "/" });
    else if (player.is_blocked) navigate({ to: "/suspended" });
  }, [player, loading, navigate]);

  if (loading || !player) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20 safe-top">
      <div className="mx-auto max-w-lg">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
