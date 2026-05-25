import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { PaymentBadge } from "@/components/Badges";
import { listMyPayments } from "@/lib/games.functions";

export const Route = createFileRoute("/app/pagamentos")({
  component: PagamentosPage,
});

function PagamentosPage() {
  const fn = useServerFn(listMyPayments);
  const { data } = useQuery({ queryKey: ["my-payments"], queryFn: () => fn() });

  const pendingTotal = (data ?? [])
    .filter((p) => p.status === "pending" || p.status === "late")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Pagamentos</h1>

      <Card className="bg-gradient-field p-5">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold">Total pendente</div>
        <div className="text-3xl font-bold mt-1">R$ {pendingTotal.toFixed(2)}</div>
      </Card>

      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <Card key={p.id} className="bg-card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.games?.title}</div>
              <div className="text-xs text-muted-foreground">
                {p.games?.date ? new Date(`${p.games.date}T${p.games.time}`).toLocaleDateString("pt-BR") : ""}
                {" · R$ "}{Number(p.amount ?? 0).toFixed(2)}
              </div>
            </div>
            <PaymentBadge status={p.status as "paid" | "pending" | "late" | "exempt"} />
          </Card>
        ))}
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
        ) : null}
      </div>
    </div>
  );
}
