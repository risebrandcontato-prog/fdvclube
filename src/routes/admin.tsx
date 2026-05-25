import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { player, loading } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!player) navigate({ to: "/" });
    else if (!player.is_admin) navigate({ to: "/app" });
  }, [player, loading, navigate]);

  if (loading || !player?.is_admin) {
    return <div className="min-h-dvh bg-background flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="min-h-dvh bg-background pb-20 safe-top">
      <div className="mx-auto max-w-lg">
        <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground px-4 pt-4">
          <ArrowLeft className="h-4 w-4" /> App
        </Link>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
