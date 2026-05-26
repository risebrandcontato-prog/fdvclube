import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGames } from "@/lib/games.functions";
import { useSession } from "@/hooks/use-session";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CreditCard,
  ChevronRight,
  CircleCheck,
  CircleX,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/app/jogos/")({
  component: JogosListPage,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData({
      queryKey: ["games"],
      queryFn: () => listGames(),
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

function JogosListPage() {
  const { player } = useSession();
  const fn = useServerFn(listGames);
  const { data, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: () => fn(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const today = new Date().toISOString().slice(0, 10);
  const games = (data?.games ?? []) as any[];
  const upcoming = games.filter(
    (g: any) => g.date >= today && g.status !== "cancelled"
  );
  const past = games.filter(
    (g: any) => g.date < today || g.status === "done" || g.status === "cancelled"
  );

  return (
    <div>
      {/* Header */}
      <div className="bg-card border-b px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Jogos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe seus jogos, confirmações e pagamentos
        </p>
      </div>

      <div className="px-4 py-6 space-y-8">
        {/* === PRÓXIMOS JOGOS === */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Próximos Jogos
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {upcoming.length} {upcoming.length === 1 ? "jogo" : "jogos"}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <GameCardSkeleton />
              <GameCardSkeleton />
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-10 w-10 opacity-60" />}
              title="Nenhum jogo agendado"
              subtitle="Fique de olho! Novos jogos aparecerão aqui."
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map((g: any) => (
                <GameCard key={g.id} game={g} player={player} />
              ))}
            </div>
          )}
        </section>

        {/* === JOGOS ANTERIORES === */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Jogos Anteriores
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {past.length} {past.length === 1 ? "jogo" : "jogos"}
            </span>
          </div>

          {past.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-10 w-10" />}
              title="Nenhum jogo anterior"
              subtitle="Os jogos realizados aparecerão nesta lista."
            />
          ) : (
            <div className="space-y-3">
              {past.map((g: any) => (
                <PastGameCard key={g.id} game={g} player={player} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ========== GAME CARD (com Link) ========== */
function GameCard({ game, player }: { game: any; player: any }) {
  const confirmed =
    game.confirmations?.filter((c: any) => c.status === "confirmed") ?? [];
  const confirmedCount = confirmed.length;
  const myConf = game.confirmations?.find(
    (c: any) => c.player_id === player?.id
  );
  const myPay = game.payments?.find(
    (p: any) => p.player_id === player?.id
  );

  const dateObj = new Date(`${game.date}T${game.time}`);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString("pt-BR", { month: "short" });
  const weekday = dateObj.toLocaleString("pt-BR", { weekday: "long" });
  const timeStr = dateObj.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const max = game.max_players || 1;
  const vacancyRate = Math.min(100, (confirmedCount / max) * 100);
  const vacanciesLeft = Math.max(0, max - confirmedCount);

  const st = statusConfig[game.status] ?? statusConfig.scheduled;

  return (
    <Link
      to="/app/jogos/$id"
      params={{ id: game.id }}
      className="block"
    >
      <Card className="overflow-hidden cursor-pointer border hover:border-primary/40 transition-all duration-200 hover:shadow-md group">
        <div className="p-4">
          <div className="flex gap-4">
            {/* Date block */}
            <div className="flex flex-col items-center justify-start min-w-14 pt-1">
              <span className="text-3xl font-bold text-primary leading-none">
                {day}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase mt-1">
                {month}
              </span>
              <span className="text-[10px] text-muted-foreground/70 capitalize mt-0.5 leading-none">
                {weekday}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-[15px] leading-snug truncate group-hover:text-primary transition-colors">
                  {game.title}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 mt-0.5 ${st.cls}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {timeStr}
                </span>
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {game.locations?.name ?? "Sem campo definido"}
                </span>
                {game.locations?.address && (
                  <span className="truncate text-muted-foreground/70">
                    {game.locations.address}
                  </span>
                )}
              </div>

              {game.locations?.photo_url && (
                <div className="mb-3 rounded-lg overflow-hidden h-32 w-full">
                  <img
                    src={game.locations.photo_url}
                    alt={game.locations.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="flex -space-x-2 shrink-0">
                  {confirmed.slice(0, 5).map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden"
                      title={c.players?.name ?? "Jogador"}
                    >
                      {c.players?.avatar_url ? (
                        <img
                          src={c.players.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {(c.players?.name ?? "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                  {confirmed.length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      +{confirmed.length - 5}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {confirmedCount} / {max}
                    </span>
                    <span className="font-medium">
                      {vacanciesLeft > 0
                        ? `${vacanciesLeft} vaga${vacanciesLeft > 1 ? "s" : ""}`
                        : "Lotado"}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
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
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 flex-wrap">
                  {myConf?.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      <CircleCheck className="h-3.5 w-3.5" /> Você vai
                    </span>
                  ) : myConf?.status === "cancelled" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
                      <CircleX className="h-3.5 w-3.5" /> Você não vai
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      <AlertCircle className="h-3.5 w-3.5" /> Pendente
                    </span>
                  )}

                  {myPay && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                        myPay.status === "paid"
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {myPay.status === "paid" ? "Pago" : "Pendente"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    R${" "}
                    {(game.contribution_amount ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ========== PAST GAME CARD ========== */
function PastGameCard({ game, player }: { game: any; player: any }) {
  const confirmed =
    game.confirmations?.filter((c: any) => c.status === "confirmed") ?? [];
  const myConf = game.confirmations?.find(
    (c: any) => c.player_id === player?.id
  );

  const dateObj = new Date(`${game.date}T${game.time}`);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString("pt-BR", { month: "short" });
  const year = dateObj.getFullYear();

  const st = statusConfig[game.status] ?? statusConfig.done;

  return (
    <Link to="/app/jogos/$id" params={{ id: game.id }} className="block">
      <Card className="overflow-hidden cursor-pointer border opacity-80 hover:opacity-100 transition-opacity hover:border-primary/30">
        <div className="p-3 flex items-center gap-3">
          <div className="flex flex-col items-center justify-center min-w-12">
            <span className="text-xl font-bold text-muted-foreground leading-none">
              {day}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase mt-0.5">
              {month}
            </span>
            <span className="text-[9px] text-muted-foreground/60">{year}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <h4 className="font-medium text-sm truncate">{game.title}</h4>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${st.cls}`}
              >
                <span className={`w-1 h-1 rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {game.locations?.name ?? "Sem campo"}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {confirmed.length} jogadores
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {confirmed.slice(0, 4).map((c: any, idx: number) => (
                  <div
                    key={idx}
                    className="w-5 h-5 rounded-full border border-background bg-muted flex items-center justify-center text-[8px] font-bold overflow-hidden"
                  >
                    {c.players?.avatar_url ? (
                      <img
                        src={c.players.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {(c.players?.name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {myConf?.status === "confirmed" && (
                  <span className="text-[10px] font-semibold text-emerald-400">
                    Você foi
                  </span>
                )}
                {myConf?.status === "cancelled" && (
                  <span className="text-[10px] font-semibold text-red-400">
                    Você não foi
                  </span>
                )}
                {!myConf && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    Não confirmado
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ========== SKELETON ========== */
function GameCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-4 animate-pulse">
        <div className="h-14 w-14 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-2 w-3/4 bg-muted rounded" />
        </div>
      </div>
    </Card>
  );
}

/* ========== EMPTY STATE ========== */
function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl bg-card/50">
      <div className="text-muted-foreground/40 mb-3">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-48">
        {subtitle}
      </p>
    </div>
  );
}