import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionBadge } from "@/components/Badges";
import { useSession } from "@/hooks/use-session";
import { myAttendanceHistory } from "@/lib/games.functions";

export const Route = createFileRoute("/app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { player, logout } = useSession();
  const navigate = useNavigate();
  const fn = useServerFn(myAttendanceHistory);
  const { data } = useQuery({ queryKey: ["my-attendance"], queryFn: () => fn() });

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <Card className="bg-card p-5 flex items-center gap-4">
        <PlayerAvatar name={player?.name} src={player?.avatar_url} className="h-16 w-16 ring-2 ring-primary/40" />
        <div className="min-w-0">
          <div className="font-semibold text-lg flex items-center gap-2">
            {player?.name}
            {player?.is_admin ? <Shield className="h-4 w-4 text-primary" /> : null}
          </div>
          <div className="mt-1"><PositionBadge position={player?.position ?? ""} /></div>
        </div>
      </Card>

      <Card className="bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Histórico de presenças ({data?.length ?? 0})
        </div>
        <div className="space-y-2">
          {(data ?? []).map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{c.games?.title}</span>
              <span className="text-muted-foreground">
                {c.games?.date ? new Date(c.games.date).toLocaleDateString("pt-BR") : ""}
              </span>
            </div>
          ))}
          {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem histórico.</p> : null}
        </div>
      </Card>

      <Button
        variant="outline"
        className="w-full h-12"
        onClick={async () => { await logout(); navigate({ to: "/" }); }}
      >
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}
