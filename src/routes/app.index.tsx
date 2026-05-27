import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { MapPin, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerCard } from "@/components/PlayerCard";
import { PaymentBadge, ConfirmBadge } from "@/components/Badges";
import { FdvLogo } from "@/components/FdvLogo";
import { getHomeData, setMyConfirmation } from "@/lib/games.functions";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

function HomePage() {
  const { player } = useSession();
  const getHome = useServerFn(getHomeData);
  const setConf = useServerFn(setMyConfirmation);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: () => getHome(),
  });

  useEffect(() => {
    const ch = supabase
      .channel("home-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "confirmations" }, () =>
        qc.invalidateQueries({ queryKey: ["home"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () =>
        qc.invalidateQueries({ queryKey: ["home"] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  async function toggle(status: "confirmed" | "cancelled") {
    if (!data?.nextGame) return;
    try {
      await setConf({ data: { gameId: data.nextGame.id, status } });
      toast.success(status === "confirmed" ? "Presença confirmada!" : "Presença cancelada");
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={player?.name} src={player?.avatar_url} className="h-11 w-11" />
          <div>
            <div className="text-xs text-muted-foreground">Olá,</div>
            <div className="font-semibold text-foreground leading-tight">{player?.name}</div>
          </div>
        </div>
        <FdvLogo className="h-9 w-9" />
      </header>

      {isLoading ? (
        <Card className="bg-card p-6 animate-pulse h-48" />
      ) : !data?.nextGame ? (
        <Card className="bg-card p-6 text-center">
          <div className="text-sm text-muted-foreground">Nenhum jogo agendado.</div>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-field border-primary/30 p-5 shadow-glow">
            <div className="text-xs uppercase tracking-wider text-primary font-semibold">Próximo jogo</div>
            <div className="mt-1 text-xl font-bold">{data.nextGame.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {new Date(`${data.nextGame.date}T${data.nextGame.time}`).toLocaleString("pt-BR", {
                weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
              })}
            </div>
            {data.result ? (
              <div className="mt-1 text-sm font-semibold text-primary">
                Placar: {data.result.score_a ?? 0} x {data.result.score_b ?? 0}
              </div>
            ) : null}
            {data.nextGame.locations ? (
              <div className="mt-2 flex items-center gap-1 text-sm text-foreground/80">
                <MapPin className="h-4 w-4 text-primary" />
                {data.nextGame.locations.name}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              <ConfirmBadge status={data.myConfirmation?.status ?? "none"} />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">
                  {data.confirmations.filter((c) => c.status === "confirmed").length}
                </span>
                /{data.nextGame.max_players} confirmados
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={() => toggle("confirmed")}
                disabled={data.myConfirmation?.status === "confirmed"}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-11"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmar
              </Button>
              <Button
                onClick={() => toggle("cancelled")}
                disabled={data.myConfirmation?.status === "cancelled"}
                variant="outline"
                className="h-11"
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </Card>

          <Card className="bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Pagamento deste jogo</div>
                <div className="font-semibold mt-0.5">
                  R$ {Number(data.nextGame.contribution_amount ?? 0).toFixed(2)}
                </div>
              </div>
              <PaymentBadge status={(data.myPayment?.status as "paid" | "pending" | "late" | "exempt") ?? "pending"} />
            </div>
          </Card>

          {data.nextGame.locations ? (
            <Card className="bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{data.nextGame.locations.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{data.nextGame.locations.address}</div>
                </div>
                {data.nextGame.locations.maps_url ? (
                  <a
                    href={data.nextGame.locations.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    Ver no mapa <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card className="bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Confirmados ({data.confirmations.filter((c) => c.status === "confirmed").length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.confirmations
                .filter((c) => c.status === "confirmed")
                .map((c) => (
                  <PlayerCard
                    key={c.player_id}
                    playerId={c.player_id}
                    name={c.players?.name ?? "Jogador"}
                    avatarUrl={c.players?.avatar_url}
                    position={c.players?.position}
                    status="confirmed"
                  />
                ))}
              {data.confirmations.filter((c) => c.status === "confirmed").length === 0 ? (
                <span className="text-sm text-muted-foreground">Ninguém confirmado ainda.</span>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
