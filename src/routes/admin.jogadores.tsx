import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionBadge } from "@/components/Badges";
import { adminListPlayers, adminSetPlayerBlocked, adminDeletePlayer } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogadores")({
  component: JogadoresPage,
});

function JogadoresPage() {
  const list = useServerFn(adminListPlayers);
  const setBlock = useServerFn(adminSetPlayerBlocked);
  const deletePlayer = useServerFn(adminDeletePlayer);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-players"], queryFn: () => list() });

  async function toggle(id: string, blocked: boolean) {
    try {
      await setBlock({ data: { playerId: id, blocked } });
      toast.success(blocked ? "Jogador bloqueado" : "Jogador desbloqueado");
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir jogador permanentemente do banco?")) return;
    try {
      await deletePlayer({ data: { playerId: id } });
      toast.success("Jogador excluído permanentemente.");
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir jogador"); }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Jogadores</h1>
      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <Card key={p.id} className="bg-card p-3 flex items-center gap-3">
            <PlayerAvatar name={p.name} src={p.avatar_url} className="h-11 w-11" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2">
                {p.name}
                {p.is_admin ? <Shield className="h-3.5 w-3.5 text-primary" /> : null}
              </div>
              <div className="mt-0.5"><PositionBadge position={p.position} /></div>
            </div>
            {!p.is_admin ? (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => toggle(p.id, !p.is_blocked)}>
                  {p.is_blocked ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Ban className="h-4 w-4 text-destructive" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
