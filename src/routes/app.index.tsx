import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Users,
  Trophy,
  TrendingUp,
  CreditCard,
  ChevronRight,
  Shield,
  Footprints,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerCard } from "@/components/PlayerCard";
import { PaymentBadge, ConfirmBadge } from "@/components/Badges";
import { FdvLogo } from "@/components/FdvLogo";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { getHomeData, setMyConfirmation, getRankingStats } from "@/lib/games.functions";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

function HomePage() {
  const { player } = useSession();
  const getHome = useServerFn(getHomeData);
  const setConf = useServerFn(setMyConfirmation);
  const getRanking = useServerFn(getRankingStats);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: () => getHome(),
    staleTime: 1000 * 30,
  });

  const { data: rankingData } = useQuery({
    queryKey: ["ranking", "all"],
    queryFn: () => getRanking({ data: { period: "all" } }),
    enabled: !!data?.me,
    staleTime: 1000 * 60 * 5,
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

  // ── Helpers ──
  const nextGame = data?.nextGame;
  const myConf = data?.myConfirmation;
  const myPayment = data?.myPayment;
  const gameLocation = nextGame?.location ?? data?.location;
  const confirmations = data?.confirmations ?? [];
  const confirmedList = confirmations.filter((c: any) => c.status === "confirmed");
  const result = data?.result;

  // Ranking do jogador logado
  const myRank = rankingData?.ranking?.find((r: any) => r.playerId === player?.id);

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={player?.name} src={player?.avatar_url} className="h-11 w-11" />
          <div>
            <div className="text-xs text-muted-foreground">Olá,</div>
            <div className="font-semibold text-foreground leading-tight">{player?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {player?.id ? <PushNotificationToggle playerId={player.id} /> : null}
          <FdvLogo className="h-9 w-9" />
        </div>
      </header>

      {/* ===== RANKING RÁPIDO ===== */}
      {myRank && (
        <Card className="bg-linear-to-r from-amber-500/5 to-yellow-500/5 border-amber-500/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold">Seu ranking</span>
            </div>
            <Link
              to="/app/estatisticas"
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Ver completo <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 text-center">
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-emerald-400">{myRank.goals ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Gols</p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-blue-400">{myRank.assists ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Assists</p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-amber-400">{myRank.games ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Jogos</p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-purple-400">
                {myRank.avgRating ? myRank.avgRating.toFixed(1) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Nota</p>
            </div>
          </div>
        </Card>
      )}

      {/* ===== LOADING / EMPTY / GAME CARD ===== */}
      {isLoading ? (
        <Card className="bg-card p-6 animate-pulse h-48" />
      ) : !nextGame ? (
        <Card className="bg-card p-8 text-center space-y-3">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="text-sm text-muted-foreground">Nenhum jogo agendado no momento.</div>
          <div className="text-xs text-muted-foreground">Fique de olho, em breve teremos novidades!</div>
        </Card>
      ) : (
        <>
          {/* Próximo Jogo */}
          <Card className="bg-linear-to-br from-primary/5 to-primary/10 border-primary/20 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs uppercase tracking-wider text-primary font-semibold">Próximo jogo</div>
              {nextGame.status === "scheduled" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                  Agendado
                </span>
              )}
            </div>

            <div className="mt-1 text-xl font-bold">{nextGame.title}</div>
            <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(`${nextGame.date}T${nextGame.time}`).toLocaleDateString("pt-BR", {
                  weekday: "long", day: "2-digit", month: "long",
                })}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {nextGame.time}
              </span>
            </div>

            {/* Resultado (se jogo já realizado) */}
            {result && (
              <div className="mt-3 p-2.5 rounded-lg bg-background/60 flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Time A</div>
                  <div className="text-2xl font-black">{result.score_a ?? 0}</div>
                </div>
                <div className="text-muted-foreground font-bold">x</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Time B</div>
                  <div className="text-2xl font-black">{result.score_b ?? 0}</div>
                </div>
              </div>
            )}

            {/* Local */}
            {gameLocation && (
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-foreground/80">{gameLocation.name}</span>
              </div>
            )}

            {/* Status e vagas */}
            <div className="mt-4 flex items-center justify-between">
              <ConfirmBadge status={myConf?.status ?? "none"} />
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="text-foreground font-semibold">{confirmedList.length}</span>
                /{nextGame.max_players} confirmados
              </span>
            </div>

            {/* Barra de vagas */}
            <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  confirmedList.length >= nextGame.max_players
                    ? "bg-red-400"
                    : confirmedList.length >= nextGame.max_players - 2
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, (confirmedList.length / nextGame.max_players) * 100)}%` }}
              />
            </div>

            {/* Botões de ação */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={() => toggle("confirmed")}
                disabled={myConf?.status === "confirmed"}
                className={`h-11 text-sm font-semibold ${
                  myConf?.status === "confirmed"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {myConf?.status === "confirmed" ? "Confirmado" : "Confirmar"}
              </Button>
              <Button
                onClick={() => toggle("cancelled")}
                disabled={myConf?.status === "cancelled"}
                variant="outline"
                className={`h-11 text-sm font-semibold ${
                  myConf?.status === "cancelled"
                    ? "border-red-500/30 text-red-400 bg-red-500/5"
                    : ""
                }`}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                {myConf?.status === "cancelled" ? "Cancelado" : "Cancelar"}
              </Button>
            </div>
          </Card>

          {/* Pagamento */}
          <Card className="bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Contribuição</div>
                  <div className="font-semibold">
                    R$ {Number(nextGame.contribution_amount ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <PaymentBadge
                status={(myPayment?.status as "paid" | "pending" | "late" | "exempt") ?? "pending"}
              />
            </div>
            {myPayment?.status === "pending" && (
              <div className="mt-2 text-xs text-amber-400 bg-amber-500/5 p-2 rounded-md">
                ⚠️ Não esqueça de realizar o pagamento antes do jogo!
              </div>
            )}
          </Card>

          {/* Local detalhado */}
          {gameLocation && (
            <Card className="bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold truncate">{gameLocation.name}</span>
                  </div>
                  {gameLocation.address && (
                    <div className="text-xs text-muted-foreground truncate">{gameLocation.address}</div>
                  )}
                  {/* city/state/phone removidos — schema não tem essas colunas */}
                </div>
                {gameLocation.maps_url && (
                  <a
                    href={gameLocation.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Mapa <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Confirmados */}
          <Card className="bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Confirmados ({confirmedList.length})
              </div>
              {confirmedList.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {nextGame.max_players - confirmedList.length} vaga{nextGame.max_players - confirmedList.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {confirmedList.length === 0 ? (
                <span className="text-sm text-muted-foreground col-span-full">Ninguém confirmado ainda. Seja o primeiro!</span>
              ) : (
                confirmedList.map((c: any) => {
                  const p = c.player;
                  return (
                    <PlayerCard
                      key={c.player_id}
                      playerId={c.player_id}
                      name={p?.name ?? "Jogador"}
                      avatarUrl={p?.avatar_url}
                      position={p?.preferred_position ?? p?.position}
                      status="confirmed"
                    />
                  );
                })
              )}
            </div>
          </Card>

          {/* Ações rápidas */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/app/jogos">
              <Card className="bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Todos os jogos</span>
                </div>
              </Card>
            </Link>
            <Link to="/app/estatisticas">
              <Card className="bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Estatísticas</span>
                </div>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
