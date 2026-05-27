import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { player, loading, error, refresh } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // Só redireciona se NÃO houver erro de rede (erro de rede = tenta de novo)
    if (!player && error === "UNAUTHENTICATED") {
      navigate({ to: "/" });
    } else if (player?.is_blocked) {
      navigate({ to: "/suspended" });
    }
  }, [player, loading, error, navigate]);

  // Loading inicial
  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Carregando sessão...</p>
      </div>
    );
  }

  // Erro de rede/autenticação temporária — mostra retry em vez de redirecionar
  if (error && error !== "UNAUTHENTICATED") {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
        <div className="text-center">
          <p className="text-foreground font-medium">Algo deu errado</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
          <Button onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Sem player e autenticação confirmada inválida
  if (!player) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Verificando acesso...</p>
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