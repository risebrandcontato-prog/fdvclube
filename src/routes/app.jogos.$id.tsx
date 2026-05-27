import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGameDetail, setMyConfirmation } from "@/lib/games.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/PlayerCard";

export const Route = createFileRoute("/app/jogos/$id")({
  component: GameDetailPage,
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await queryClient.ensureQueryData({
      queryKey: ["game", id],
      queryFn: () => getGameDetail({ data: { id } }),
      staleTime: 1000 * 60 * 5,
    });
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
};

function GameDetailPage() {
  const { id } = Route.useParams();
  const { player } = useSession();
  const qc = useQueryClient();

  const detailFn = useServerFn(getGameDetail);
  const confirmFn = useServerFn(setMyConfirmation);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["game", id],
    queryFn: () => detailFn({ data: { id } }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const game = data?.game;
  const location = data?.location;
  const confirmations = (data?.confirmations ?? []) as any[];
  const myPayment = data?.myPayment as any;

  const confirmedList = confirmations.filter((c: any) => c.status === "confirmed");
  const cancelledList = confirmations.filter((c: any) => c.status === "cancelled");

  const myConf = confirmations.find((c: any) => c.player_id === player?.id);
  const myStatus = myConf?.status as "confirmed" | "cancelled" | undefined;

  const max = game?.max_players || 1;
  const confirmedCount = confirmedList.length;
  const vacancyRate = Math.min(100, (confirmedCount / max) * 100);
  const vacanciesLeft = Math.max(0, max - confirmedCount);

  const dateObj = game ? new Date(`${game.date}T${game.time}`) : null;
  const day = dateObj?.getDate();
  const month = dateObj?.toLocaleString("pt-BR", { month: "short" });
  const weekday = dateObj?.toLocaleString("pt-BR", { weekday: "long" });
  const timeStr = dateObj?.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const st = statusConfig[game?.status] ?? statusConfig.scheduled;

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
          <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-zinc-900 flex items-center justify-center">
            <MapPin className="h-12 w-12 text-emerald-500/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
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
            Quem vai ({confirmedCount})
          </h2>
          {confirmedList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ninguém confirmou presença ainda.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {confirmedList.map((c: any, idx: number) => {
                const p = c.players;
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
                const p = c.players;
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
            {myPayment && (
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Seu pagamento
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                    myPayment.status === "paid"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-amber-400 bg-amber-500/10"
                  }`}
                >
                  {myPayment.status === "paid" ? (
                    <>
                      <CircleCheck className="h-3 w-3" /> Pago
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" /> Pendente
                    </>
                  )}
                </span>
              </div>
            )}
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