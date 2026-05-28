import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Goal,
  Handshake,
  Trophy,
  Star,
  Calendar,
  TrendingUp,
  Medal,
  Crown,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getRankingStats } from "@/lib/games.functions";

type Period = "week" | "month" | "season" | "all";
type Metric = "goals" | "assists" | "avgRating" | "games" | "saves" | "ownGoals";

export const Route = createFileRoute("/app/estatisticas")({
  component: RankingPage,
});

function RankingPage() {
  const navigate = useNavigate();
  const rankingFn = useServerFn(getRankingStats);
  const [period, setPeriod] = useState<Period>("all");
  const [metric, setMetric] = useState<Metric>("goals");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ranking", period],
    queryFn: () => rankingFn({ data: { period } }),
  });

  const sorted = useMemo(() => {
    const rows = [...(data?.ranking ?? [])];
    if (metric === "avgRating") {
      return rows
        .filter((r) => r.qualifiesForRating)
        .sort((a, b) => Number(b.avgRating ?? 0) - Number(a.avgRating ?? 0));
    }
    return rows.sort((a, b) => Number(b[metric] ?? 0) - Number(a[metric] ?? 0));
  }, [data?.ranking, metric]);

  // ── Helpers de UI ──
  const metricConfig: Record<Metric, { label: string; icon: React.ReactNode; color: string; unit: string }> = {
    goals: { label: "Artilheiros", icon: <Goal className="h-4 w-4" />, color: "text-emerald-400", unit: "gols" },
    assists: { label: "Assistências", icon: <Handshake className="h-4 w-4" />, color: "text-blue-400", unit: "assists" },
    avgRating: { label: "Nota Média", icon: <Star className="h-4 w-4" />, color: "text-amber-400", unit: "nota" },
    games: { label: "Jogos", icon: <Trophy className="h-4 w-4" />, color: "text-purple-400", unit: "jogos" },
    saves: { label: "Defesas", icon: <Medal className="h-4 w-4" />, color: "text-cyan-400", unit: "defesas" },
    ownGoals: { label: "Gols Contra", icon: <TrendingUp className="h-4 w-4" />, color: "text-red-400", unit: "GC" },
  };

  const currentMetric = metricConfig[metric];

  // Top 3 destaque
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
      {/* ===== HEADER ===== */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/app" })}
        className="px-2 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Estatísticas</h1>
        <p className="text-sm text-muted-foreground">Ranking dos jogadores por categoria.</p>
      </div>

      {/* ===== FILTRO DE PERÍODO ===== */}
      <Card className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Período</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "week" as Period, label: "Esta semana" },
            { value: "month" as Period, label: "Este mês" },
            { value: "season" as Period, label: "Temporada" },
            { value: "all" as Period, label: "Todos" },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={period === option.value ? "default" : "outline"}
              onClick={() => setPeriod(option.value)}
              className="justify-start text-xs h-9"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* ===== FILTRO DE CATEGORIA ===== */}
      <Card className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Categoria</p>
        <div className="grid grid-cols-2 gap-2">
          {( [
            { value: "goals" as Metric, label: "Artilheiros", icon: <Goal className="h-4 w-4 mr-1.5" /> },
            { value: "assists" as Metric, label: "Assistências", icon: <Handshake className="h-4 w-4 mr-1.5" /> },
            { value: "avgRating" as Metric, label: "Nota Média", icon: <Star className="h-4 w-4 mr-1.5" /> },
            { value: "games" as Metric, label: "Jogos", icon: <Trophy className="h-4 w-4 mr-1.5" /> },
            { value: "saves" as Metric, label: "Defesas", icon: <Medal className="h-4 w-4 mr-1.5" /> },
            { value: "ownGoals" as Metric, label: "Gols Contra", icon: <TrendingUp className="h-4 w-4 mr-1.5" /> },
          ] ).map((option) => (
            <Button
              key={option.value}
              variant={metric === option.value ? "default" : "outline"}
              onClick={() => setMetric(option.value)}
              className="justify-start text-xs h-9"
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* ===== ESTADO: LOADING ===== */}
      {isLoading && (
        <div className="space-y-3">
          <Card className="h-32 animate-pulse bg-muted" />
          <Card className="h-16 animate-pulse bg-muted" />
          <Card className="h-16 animate-pulse bg-muted" />
          <Card className="h-16 animate-pulse bg-muted" />
        </div>
      )}

      {/* ===== ESTADO: ERRO ===== */}
      {isError && (
        <Card className="p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar ranking."}
        </Card>
      )}

      {/* ===== ESTADO: VAZIO ===== */}
      {!isLoading && !isError && sorted.length === 0 && (
        <Card className="p-6 text-center space-y-2">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Sem dados suficientes para este filtro.</p>
          <p className="text-xs text-muted-foreground">Tente outro período ou categoria.</p>
        </Card>
      )}

      {/* ===== ESTADO: DADOS ===== */}
      {!isLoading && !isError && sorted.length > 0 && (
        <>
          {/* Podium - Top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {top3.map((row, idx) => {
                const rank = idx + 1;
                const isFirst = rank === 1;
                return (
                  <Card
                    key={row.playerId}
                    className={`p-3 text-center ${
                      isFirst
                        ? "bg-linear-to-b from-amber-500/10 to-yellow-500/5 border-amber-500/20"
                        : "bg-card"
                    }`}
                  >
                    <div className="flex justify-center mb-2">
                      {isFirst ? (
                        <Crown className="h-6 w-6 text-amber-400" />
                      ) : rank === 2 ? (
                        <Medal className="h-5 w-5 text-slate-300" />
                      ) : (
                        <Medal className="h-5 w-5 text-amber-700" />
                      )}
                    </div>
                    <PlayerAvatar
                      name={row.name}
                      src={row.avatar_url}
                      className="h-12 w-12 mx-auto mb-2"
                    />
                    <p className="text-xs font-semibold truncate">{row.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{row.position || "—"}</p>
                    <p className={`text-lg font-black mt-1 ${currentMetric.color}`}>
                      {metric === "avgRating"
                        ? Number(row.avgRating ?? 0).toFixed(1)
                        : Number(row[metric] ?? 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{currentMetric.unit}</p>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Lista completa */}
          <div className="space-y-2">
            {rest.map((row, idx) => {
              const rank = idx + 4;
              return (
                <Card key={row.playerId} className="p-3 flex items-center gap-3">
                  <div className="w-7 text-center font-bold text-muted-foreground text-sm">
                    {rank}
                  </div>
                  <PlayerAvatar
                    name={row.name}
                    src={row.avatar_url}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.position || "Sem posição"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {metric === "avgRating"
                        ? Number(row.avgRating ?? 0).toFixed(1)
                        : Number(row[metric] ?? 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{currentMetric.unit}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
