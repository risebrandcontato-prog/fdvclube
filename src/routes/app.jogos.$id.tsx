import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGameDetail, setMyConfirmation, submitMyGameStats } from "@/lib/games.functions";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  CreditCard,
  CircleCheck,
  CircleX,
  AlertCircle,
  Navigation,
  Banknote,
  StickyNote,
  ShieldAlert,
  ChevronRight,
  Trophy,
  Swords,
  Target,
  Footprints,
  Shield,
  Star,
  BarChart3,
  Edit3,
  Save,
  X,
  Medal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerCard } from "@/components/PlayerCard";

export const Route = createFileRoute("/app/jogos/$id")({
  component: GameDetailPage,
  loader: async ({ context: { queryClient }, params: { id } }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: ["game", id],
        queryFn: () => getGameDetail({ data: { id } }),
        staleTime: 1000 * 60 * 5,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        throw redirect({ to: "/" });
      }
      throw error;
    }
  },
});

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  scheduled: {
    label: "Agendado",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelado",
    cls: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
  done: {
    label: "Realizado",
    cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
  },
  finished: {
    label: "Realizado",
    cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
  },
};

const teamColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  A: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    badge: "bg-blue-500",
  },
  B: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    badge: "bg-red-500",
  },
};

const positionGroups: Array<{
  key: "goleiro" | "defensor" | "meio" | "atacante";
  label: string;
  icon: string;
}> = [
  { key: "goleiro", label: "Goleiros", icon: "🧤" },
  { key: "defensor", label: "Defensores", icon: "🛡️" },
  { key: "meio", label: "Meios", icon: "⚙️" },
  { key: "atacante", label: "Atacantes", icon: "⚡" },
];

type PaymentStatus = "paid" | "pending" | "late" | "exempt" | null | undefined;

const paymentBadgeConfig: Record<Exclude<PaymentStatus, null | undefined>, { label: string; className: string }> = {
  paid: {
    label: "Pago",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  pending: {
    label: "Pendente",
    className: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  late: {
    label: "Atrasado",
    className: "bg-red-500/10 text-red-300 border-red-500/30",
  },
  exempt: {
    label: "Isento",
    className: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  },
};

function getPaymentBadge(status: PaymentStatus, size: "sm" | "xs" = "sm") {
  const sizeClasses = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  if (!status) {
    return (
      <span className={`inline-flex items-center rounded-full border border-zinc-500/30 bg-zinc-500/10 font-semibold leading-none whitespace-nowrap ${sizeClasses} text-zinc-300`}>
        Pendente
      </span>
    );
  }

  const cfg = paymentBadgeConfig[status];
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold leading-none whitespace-nowrap ${sizeClasses} ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const target = new Date(targetDate);
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft(null);
        return false;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
      return true;
    };

    const running = calculate();
    if (!running) return;

    const timer = setInterval(() => {
      const stillRunning = calculate();
      if (!stillRunning) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5">
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="text-[11px] font-semibold text-primary/90">Contagem regressiva</span>
      <span className="tabular-nums text-sm font-bold text-primary">
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, "0")}:{String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

function GameDetailPage() {
  const { id } = Route.useParams();
  const { player } = useSession();
  const qc = useQueryClient();

  const detailFn = useServerFn(getGameDetail);
  const confirmFn = useServerFn(setMyConfirmation);
  const statsFn = useServerFn(submitMyGameStats);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["game", id],
    queryFn: () => detailFn({ data: { id } }),
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const game = data?.game;
  const location = data?.location;
  const confirmations = (data?.confirmations ?? []) as any[];
  const myPayment = data?.myPayment as any;
  const payments = (data?.payments ?? []) as Array<{ player_id: string; status: PaymentStatus; amount: number | null }>;
  const teams = (data?.teams ?? []) as any[];
  const result = data?.result as any;
  const stats = (data?.stats ?? []) as any[];

  const confirmedList = confirmations.filter((c: any) => c.status === "confirmed");
  const cancelledList = confirmations.filter((c: any) => c.status === "cancelled");

  const myConf = confirmations.find((c: any) => c.player_id === player?.id);
  const myStatus = myConf?.status as "confirmed" | "cancelled" | undefined;

  const myStats = stats.find((s: any) => s.player_id === player?.id);
  const paymentStatus = (myPayment?.status ?? "pending") as PaymentStatus;
  const paymentAmount = Number(myPayment?.amount ?? 0);
  const paymentsByPlayer = new Map(payments.map((p) => [p.player_id, p]));
  const gameStatus = String(game?.status ?? "scheduled");
  const isFinished = gameStatus === "done" || gameStatus === "finished";
  const hasSubmittedStats = !!myStats && isFinished;

  const max = game?.max_players || 1;
  const confirmedCount = confirmedList.length;
  const vacancyRate = Math.min(100, (confirmedCount / max) * 100);
  const vacanciesLeft = Math.max(0, max - confirmedCount);

  const gameDateTime = game ? `${game.date}T${game.time}` : "";

  const dateObj = game ? new Date(gameDateTime) : null;
  const day = dateObj?.getDate();
  const month = dateObj?.toLocaleString("pt-BR", { month: "short" });
  const weekday = dateObj?.toLocaleString("pt-BR", { weekday: "long" });
  const timeStr = dateObj?.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const st = statusConfig[gameStatus] ?? statusConfig.scheduled;

  const confirmedByPosition = positionGroups.reduce((acc, g) => {
    acc[g.key] = confirmedList.filter((c: any) => {
      const p = c.player;
      // IMPORTANT: group by the canonical enum position (goleiro/defensor/meio/atacante).
      // preferred_position may contain custom/freeform values and would break grouping.
      const pos = p?.position as string | undefined;
      return pos === g.key;
    });
    return acc;
  }, {} as Record<"goleiro" | "defensor" | "meio" | "atacante", any[]>);

  const confirmedOther = confirmedList.filter((c: any) => {
    const pos = c?.player?.position as string | undefined;
    return pos !== "goleiro" && pos !== "defensor" && pos !== "meio" && pos !== "atacante";
  });

  const [editStats, setEditStats] = useState(false);
  const [statForm, setStatForm] = useState({
    goals: myStats?.goals ?? 0,
    assists: myStats?.assists ?? 0,
    own_goals: myStats?.own_goals ?? 0,
    saves: myStats?.saves ?? 0,
    yellow_cards: myStats?.yellow_cards ?? 0,
    red_cards: myStats?.red_cards ?? 0,
  });

  useEffect(() => {
    if (myStats) {
      setStatForm({
        goals: myStats.goals ?? 0,
        assists: myStats.assists ?? 0,
        own_goals: myStats.own_goals ?? 0,
        saves: myStats.saves ?? 0,
        yellow_cards: myStats.yellow_cards ?? 0,
        red_cards: myStats.red_cards ?? 0,
      });
    }
  }, [myStats]);

  useEffect(() => {
    const channel = supabase
      .channel(`game-live-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_teams", filter: `game_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["game", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_results", filter: `game_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["game", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "confirmations", filter: `game_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["game", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `game_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["game", id] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, qc]);

  async function handleConfirm(status: "confirmed" | "cancelled") {
    try {
      await confirmFn({ data: { gameId: id, status } });
      toast.success(
        status === "confirmed" ? "Presença confirmada!" : "Presença cancelada"
      );
      qc.invalidateQueries({ queryKey: ["game", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) {
      toast.error("Erro ao atualizar presença");
    }
  }

  async function handleSaveStats() {
    try {
      await statsFn({
        data: {
          gameId: id,
          ...statForm,
        },
      });
      toast.success("Estatísticas salvas!");
      setEditStats(false);
      qc.invalidateQueries({ queryKey: ["game", id] });
    } catch (e) {
      toast.error("Erro ao salvar estatísticas");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-64 bg-muted animate-pulse" />
        <div className="px-4 py-6 space-y-4">
          <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-5 text-center space-y-3">
          <p className="text-sm text-destructive font-medium">
            {error instanceof Error ? error.message : "Erro ao carregar o jogo."}
          </p>
          <Link to="/app/jogos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar para jogos
          </Link>
        </Card>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-5 text-center space-y-3">
          <p className="text-sm font-medium">Jogo não encontrado.</p>
          <Link to="/app/jogos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar para jogos
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ===== HERO ===== */}
      <div className="relative h-64 w-full overflow-hidden">
        {location?.photo_url ? (
          <img
            src={location.photo_url}
            alt={location.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-emerald-900 to-zinc-900 flex items-center justify-center">
            <MapPin className="h-12 w-12 text-emerald-500/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-3">
          <Link
            to="/app/jogos"
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border/50 hover:bg-background transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border backdrop-blur bg-background/80 ${st.cls}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-2xl font-bold leading-tight">{game.title}</h1>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {day} {month} · {weekday}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeStr}
            </span>
          </div>
          {gameStatus === "scheduled" && gameDateTime && (
            <CountdownTimer targetDate={gameDateTime} />
          )}
        </div>
      </div>

      <div className="px-4 py-2 space-y-6">
        {/* ===== MINHA AÇÃO ===== */}
        <Card className="p-4 border border-border/80">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Sua presença</h2>
            {myStatus === "confirmed" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <CircleCheck className="h-3.5 w-3.5" /> Você vai
              </span>
            )}
            {myStatus === "cancelled" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                <CircleX className="h-3.5 w-3.5" /> Você não vai
              </span>
            )}
            {!myStatus && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3.5 w-3.5" /> Pendente
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={myStatus === "confirmed" ? "default" : "outline"}
              className={`h-11 text-sm font-semibold ${
                myStatus === "confirmed"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              }`}
              onClick={() => handleConfirm("confirmed")}
              disabled={myStatus === "confirmed"}
            >
              <CircleCheck className="h-4 w-4 mr-1.5" />
              Vou jogar
            </Button>
            <Button
              variant={myStatus === "cancelled" ? "default" : "outline"}
              className={`h-11 text-sm font-semibold ${
                myStatus === "cancelled"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "border-red-500/30 text-red-400 hover:bg-red-500/10"
              }`}
              onClick={() => handleConfirm("cancelled")}
              disabled={myStatus === "cancelled"}
            >
              <CircleX className="h-4 w-4 mr-1.5" />
              Não vou
            </Button>
          </div>
          {myStatus !== "cancelled" && (
            <button
              onClick={() => handleConfirm("cancelled")}
              className="mt-2 w-full text-[11px] text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center gap-1 py-1"
            >
              <ShieldAlert className="h-3 w-3" />
              Estou machucado / impedido
            </button>
          )}
        </Card>

        {/* ===== MEU PAGAMENTO ===== */}
        <Card className="p-4 border border-border/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" />
              Meu pagamento
            </h2>
            {getPaymentBadge(paymentStatus)}
          </div>
          <div className="mt-2">
            {paymentStatus === "exempt" ? (
              <p className="text-sm font-medium text-blue-300">Isento</p>
            ) : (
              <p className="text-sm font-medium">
                Valor:{" "}
                <span className="font-bold">
                  R$ {paymentAmount.toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </Card>

        {/* ===== TIMES ===== */}
        {!isFinished && confirmedCount > 0 && teams.length === 0 && (
          <Card className="p-4 border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-blue-400" />
              <p className="text-sm font-semibold text-blue-300">Aguardando formação dos times</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Assim que o admin clicar em sortear, os times aparecem aqui automaticamente.
            </p>
          </Card>
        )}
        {teams.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-primary" />
              Times
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teams.map((team: any, idx: number) => {
                const letter = idx === 0 ? "A" : idx === 1 ? "B" : "C";
                const color = teamColors[letter] ?? teamColors.A;
                const teamPlayers = team.players ?? [];
                return (
                  <Card
                    key={team.id ?? idx}
                    className={`p-3 border ${color.border} ${color.bg}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color.badge}`} />
                      <span className={`text-sm font-bold ${color.text}`}>
                        {team.team_name ?? `Time ${letter}`}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {teamPlayers.length} jogadores
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {teamPlayers.map((tp: any, pidx: number) => {
                        const p = tp.player;
                        return (
                          <div
                            key={pidx}
                            className="flex items-center gap-2 text-xs"
                          >
                            <img
                              src={p?.avatar_url || "/default-avatar.png"}
                              alt={p?.name ?? ""}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="text-foreground/90 truncate">
                              {p?.name ?? "Jogador"}
                            </span>
                            {p?.preferred_position && (
                              <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                                {p.preferred_position}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== PLACAR / RESULTADO ===== */}
        {isFinished && result && (
          <Card className="p-4 border border-border/80 bg-linear-to-r from-amber-500/5 to-yellow-500/5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5 mb-3">
              <Trophy className="h-4 w-4 text-amber-400" />
              Resultado
            </h2>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className={`w-10 h-10 rounded-full ${teamColors.A.badge} mx-auto mb-1`} />
                <span className="text-xs font-medium">Time A</span>
              </div>
              <div className="text-center px-4">
                <span className="text-3xl font-black tabular-nums">
                  {result.score_a ?? 0}
                </span>
                <span className="text-xl font-bold text-muted-foreground mx-2">x</span>
                <span className="text-3xl font-black tabular-nums">
                  {result.score_b ?? 0}
                </span>
              </div>
              <div className="text-center">
                <div className={`w-10 h-10 rounded-full ${teamColors.B.badge} mx-auto mb-1`} />
                <span className="text-xs font-medium">Time B</span>
              </div>
            </div>
            {result.mvp_player_id && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-400">
                <Star className="h-3.5 w-3.5" />
                <span className="font-semibold">MVP:</span>
                <span>
                  {stats.find((s: any) => s.player_id === result.mvp_player_id)?.player?.name ?? "Jogador"}
                </span>
              </div>
            )}
          </Card>
        )}

        {/* ===== ESTATÍSTICAS DO JOGO ===== */}
        {isFinished && stats.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              Estatísticas
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {stats
                .filter((s: any) => (s.goals || 0) > 0 || (s.assists || 0) > 0)
                .sort((a: any, b: any) => (b.goals || 0) - (a.goals || 0))
                .map((s: any, idx: number) => {
                  const p = s.player;
                  return (
                    <Card key={idx} className="p-3 flex items-center gap-3 border border-border/60">
                      <img
                        src={p?.avatar_url || "/default-avatar.png"}
                        alt={p?.name ?? ""}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p?.name ?? "Jogador"}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {s.goals > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <Target className="h-3 w-3" />
                              {s.goals} gol{s.goals > 1 ? "s" : ""}
                            </span>
                          )}
                          {s.assists > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                              <Footprints className="h-3 w-3" />
                              {s.assists} assist{s.assists > 1 ? "ências" : "ência"}
                            </span>
                          )}
                          {s.own_goals > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-400">
                              <Shield className="h-3 w-3" />
                              {s.own_goals} gol contra
                            </span>
                          )}
                        </div>
                      </div>
                      {idx === 0 && s.goals > 0 && (
                        <Medal className="h-5 w-5 text-amber-400 shrink-0" />
                      )}
                    </Card>
                  );
                })}
            </div>
          </section>
        )}

        {/* ===== MINHAS ESTATÍSTICAS — FORMULÁRIO ===== */}
        {isFinished && myStatus === "confirmed" && (
          <Card className="p-4 border border-border/80">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Edit3 className="h-4 w-4 text-primary" />
                {hasSubmittedStats ? "Suas estatísticas" : "Preencher estatísticas"}
              </h2>
              {!editStats && hasSubmittedStats && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditStats(true)}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              )}
            </div>

            {editStats || !hasSubmittedStats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Gols</Label>
                    <Input
                      type="number"
                      min={0}
                      value={statForm.goals}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, goals: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Assistências</Label>
                    <Input
                      type="number"
                      min={0}
                      value={statForm.assists}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, assists: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gols contra</Label>
                    <Input
                      type="number"
                      min={0}
                      value={statForm.own_goals}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, own_goals: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Defesas</Label>
                    <Input
                      type="number"
                      min={0}
                      value={statForm.saves}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, saves: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cartões amarelos</Label>
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      value={statForm.yellow_cards}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, yellow_cards: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cartões vermelhos</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      value={statForm.red_cards}
                      onChange={(e) =>
                        setStatForm((prev) => ({ ...prev, red_cards: parseInt(e.target.value) || 0 }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-sm"
                    onClick={handleSaveStats}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Salvar
                  </Button>
                  {editStats && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm"
                      onClick={() => {
                        setEditStats(false);
                        setStatForm({
                          goals: myStats?.goals ?? 0,
                          assists: myStats?.assists ?? 0,
                          own_goals: myStats?.own_goals ?? 0,
                          saves: myStats?.saves ?? 0,
                          yellow_cards: myStats?.yellow_cards ?? 0,
                          red_cards: myStats?.red_cards ?? 0,
                        });
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-emerald-400">{myStats?.goals ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Gols</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-blue-400">{myStats?.assists ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Assistências</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-amber-400">{myStats?.saves ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Defesas</p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ===== VAGAS ===== */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Vagas
            </h2>
            <span className="text-xs text-muted-foreground">
              {confirmedCount} / {max} confirmados
              {vacanciesLeft > 0
                ? ` · ${vacanciesLeft} restante${vacanciesLeft > 1 ? "s" : ""}`
                : " · Lotado"}
            </span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                vacanciesLeft === 0
                  ? "bg-red-400"
                  : vacanciesLeft <= 2
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              }`}
              style={{ width: `${vacancyRate}%` }}
            />
          </div>
        </section>

        {/* ===== QUEM VAI ===== */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <CircleCheck className="h-4 w-4 text-emerald-400" />
            Confirmados ({confirmedCount})
          </h2>
          {confirmedList.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ninguém confirmou presença ainda.</p>
          ) : (
            <div className="space-y-3">
              {positionGroups.map((g) => {
                const list = confirmedByPosition[g.key] ?? [];
                if (list.length === 0) return null;
                return (
                  <Card key={g.key} className="p-3 border border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        <span className="mr-1">{g.icon}</span>
                        {g.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({list.length})
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {list.map((c: any) => {
                        const p = c.player;
                        const playerPayment = paymentsByPlayer.get(c.player_id);
                        const playerPaymentStatus = (playerPayment?.status ?? "pending") as PaymentStatus;
                        return (
                          <PlayerCard
                            key={c.player_id}
                            playerId={c.player_id}
                            name={p?.name ?? "Jogador"}
                            avatarUrl={p?.avatar_url}
                            position={p?.position}
                            status="confirmed"
                            rightSlot={getPaymentBadge(playerPaymentStatus, "xs")}
                          />
                        );
                      })}
                    </div>
                  </Card>
                );
              })}

              {confirmedOther.length > 0 ? (
                <Card className="p-3 border border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Outros</div>
                    <div className="text-xs text-muted-foreground">({confirmedOther.length})</div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {confirmedOther.map((c: any) => {
                      const p = c.player;
                      const playerPayment = paymentsByPlayer.get(c.player_id);
                      const playerPaymentStatus = (playerPayment?.status ?? "pending") as PaymentStatus;
                      return (
                        <PlayerCard
                          key={c.player_id}
                          playerId={c.player_id}
                          name={p?.name ?? "Jogador"}
                          avatarUrl={p?.avatar_url}
                          position={p?.position ?? "—"}
                          status="confirmed"
                          rightSlot={getPaymentBadge(playerPaymentStatus, "xs")}
                        />
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>
          )}
        </section>

        {/* ===== QUEM NÃO VAI ===== */}
        {cancelledList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5 text-red-400">
              <CircleX className="h-4 w-4" />
              Não vão ({cancelledList.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cancelledList.map((c: any, idx: number) => {
                const p = c.player;
                return (
                  <PlayerCard
                    key={idx}
                    playerId={c.player_id}
                    name={p?.name ?? "Jogador"}
                    avatarUrl={p?.avatar_url}
                    position={p?.position}
                    status={c.status}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ===== CAMPO ===== */}
        <Card className="p-4 space-y-3 border border-border/80">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Local
          </h2>
          <div>
            <p className="text-sm font-medium">
              {location?.name ?? "Sem campo definido"}
            </p>
            {location?.address && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {location.address}
              </p>
            )}
          </div>
          {location?.maps_url && (
  <a
    href={location.maps_url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
  >
    
              <Navigation className="h-3.5 w-3.5" />
              Abrir no Google Maps
              <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </Card>

        {/* ===== INFORMAÇÕES ===== */}
        <Card className="p-4 space-y-3 border border-border/80">
          <h2 className="text-sm font-semibold">Informações</h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5" />
                Contribuição
              </span>
              <span className="text-sm font-bold">
                R${" "}
                {(game.contribution_amount ?? 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Meu pagamento
              </span>
              {getPaymentBadge(paymentStatus)}
            </div>
            {game.notes && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  Observações
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {game.notes}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
