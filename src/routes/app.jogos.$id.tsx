import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PaymentBadge } from "@/components/Badges";
import { getGameDetail } from "@/lib/games.functions";

export const Route = createFileRoute("/app/jogos/$id")({
  component: GameDetail,
});

function GameDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getGameDetail);
  const { data, isLoading } = useQuery({ queryKey: ["game", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading || !data?.game) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }
  const g = data.game;
  const confirmed = data.confirmations.filter((c) => c.status === "confirmed");

  return (
    <div className="px-4 py-4 space-y-4">
      <Link to="/app/jogos" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card className="bg-gradient-field p-5">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold">Jogo</div>
        <h1 className="text-xl font-bold mt-1">{g.title}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(`${g.date}T${g.time}`).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
        </p>
        {g.locations ? (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="h-4 w-4 text-primary" /> {g.locations.name}
            </div>
            {g.locations.maps_url ? (
              <a href={g.locations.maps_url} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
                Mapa <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Contribuição</div>
            <div className="font-semibold">R$ {Number(g.contribution_amount ?? 0).toFixed(2)}</div>
          </div>
          <PaymentBadge status={(data.myPayment?.status as "paid" | "pending" | "late" | "exempt") ?? "pending"} />
        </div>
      </Card>

      <Card className="bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Confirmados ({confirmed.length}/{g.max_players})
        </div>
        <div className="space-y-2">
          {confirmed.map((c) => (
            <div key={c.player_id} className="flex items-center gap-3">
              <PlayerAvatar name={c.players?.name} src={c.players?.avatar_url} className="h-9 w-9" />
              <div className="text-sm font-medium">{c.players?.name}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
