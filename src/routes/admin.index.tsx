import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, KeyRound, CalendarPlus, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const fn = useServerFn(adminDashboard);
  const { data } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });

  const shortcuts = [
    { to: "/admin/codigos", icon: KeyRound, label: "Códigos" },
    { to: "/admin/jogos", icon: CalendarPlus, label: "Jogos" },
    { to: "/admin/jogadores", icon: Users, label: "Jogadores" },
    { to: "/admin/campos", icon: MapPin, label: "Campos" },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>

      <Card className="bg-gradient-field p-5">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold">Próximo jogo</div>
        {data?.nextGame ? (
          <>
            <div className="text-lg font-bold mt-1">{data.nextGame.title}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(`${data.nextGame.date}T${data.nextGame.time}`).toLocaleString("pt-BR", {
                weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Confirmados</div>
                <div className="text-lg font-bold">{data.confirmedCount}/{data.nextGame.max_players}</div>
              </div>
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Pago</div>
                <div className="text-lg font-bold text-success">R$ {data.paidSum.toFixed(0)}</div>
              </div>
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Pendente</div>
                <div className="text-lg font-bold text-warning">R$ {data.pendingSum.toFixed(0)}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground mt-1">Nenhum jogo agendado.</div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="bg-card hover:border-primary/50 transition-colors p-4 flex flex-col items-start gap-2">
              <s.icon className="h-6 w-6 text-primary" />
              <div className="font-semibold">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="bg-card p-4">
        <div className="text-xs text-muted-foreground">Jogadores ativos</div>
        <div className="text-2xl font-bold">{data?.playersCount ?? 0}</div>
      </Card>
    </div>
  );
}
