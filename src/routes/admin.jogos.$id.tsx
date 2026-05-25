import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PaymentBadge, ConfirmBadge } from "@/components/Badges";
import { adminGameDetail, adminSetConfirmation, adminSetPayment } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogos/$id")({
  component: AdminGameDetail,
});

const payStatuses = ["paid", "pending", "late", "exempt"] as const;

function AdminGameDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(adminGameDetail);
  const setConf = useServerFn(adminSetConfirmation);
  const setPay = useServerFn(adminSetPayment);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-game", id], queryFn: () => fn({ data: { id } }) });

  if (!data?.game) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  const g = data.game;

  const confMap = new Map(data.confirmations.map((c) => [c.player_id, c.status]));
  const payMap = new Map(data.payments.map((p) => [p.player_id, p]));

  async function toggleConf(pid: string, current: string | undefined) {
    const next = current === "confirmed" ? "cancelled" : "confirmed";
    await setConf({ data: { gameId: id, playerId: pid, status: next as "confirmed" | "cancelled" } });
    qc.invalidateQueries({ queryKey: ["admin-game", id] });
  }
  async function changePay(pid: string, status: typeof payStatuses[number]) {
    try {
      await setPay({ data: { gameId: id, playerId: pid, status, amount: Number(g.contribution_amount ?? 0) } });
      qc.invalidateQueries({ queryKey: ["admin-game", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <Link to="/admin/jogos" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <Card className="bg-gradient-field p-5">
        <div className="text-lg font-bold">{g.title}</div>
        <div className="text-sm text-muted-foreground">
          {new Date(`${g.date}T${g.time}`).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
        </div>
      </Card>

      <div className="space-y-2">
        {data.players.map((p) => {
          const status = confMap.get(p.id);
          const pay = payMap.get(p.id);
          return (
            <Card key={p.id} className="bg-card p-3 space-y-2">
              <div className="flex items-center gap-3">
                <PlayerAvatar name={p.name} src={p.avatar_url} className="h-10 w-10" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="mt-0.5 flex gap-1 flex-wrap">
                    <ConfirmBadge status={(status as "confirmed" | "cancelled") ?? "none"} />
                    {pay ? <PaymentBadge status={pay.status as "paid" | "pending" | "late" | "exempt"} /> : null}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggleConf(p.id, status)}>
                  {status === "confirmed" ? "Cancelar" : "Confirmar"}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {payStatuses.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={pay?.status === s ? "default" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => changePay(p.id, s)}
                  >
                    {s === "paid" ? "Pago" : s === "pending" ? "Pend." : s === "late" ? "Atras." : "Isento"}
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
