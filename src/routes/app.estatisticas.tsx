import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Goal, Handshake, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getRankingStats } from "@/lib/games.functions";

type Period = "week" | "month" | "season" | "all";
type Metric = "goals" | "assists" | "avgRating" | "games";

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

  return (
    <div className="px-4 py-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })} className="px-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Ranking</h1>
        <p className="text-sm text-muted-foreground">Acompanhe os destaques da turma.</p>
      </div>

      <Card className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Período</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "week", label: "Esta semana" },
            { value: "month", label: "Este mês" },
            { value: "season", label: "Temporada" },
            { value: "all", label: "Todos" },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={period === option.value ? "default" : "outline"}
              onClick={() => setPeriod(option.value as Period)}
              className="justify-start"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Categoria</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={metric === "goals" ? "default" : "outline"} onClick={() => setMetric("goals")}><Goal className="h-4 w-4 mr-1" /> Artilheiros</Button>
          <Button variant={metric === "assists" ? "default" : "outline"} onClick={() => setMetric("assists")}><Handshake className="h-4 w-4 mr-1" /> Assistências</Button>
          <Button variant={metric === "avgRating" ? "default" : "outline"} onClick={() => setMetric("avgRating")}><Star className="h-4 w-4 mr-1" /> Nota média</Button>
          <Button variant={metric === "games" ? "default" : "outline"} onClick={() => setMetric("games")}><Trophy className="h-4 w-4 mr-1" /> Jogos</Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="h-44 animate-pulse bg-muted" />
      ) : isError ? (
        <Card className="p-4 text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar ranking."}</Card>
      ) : sorted.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Sem dados suficientes para este filtro.</Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((row, idx) => (
            <Card key={row.playerId} className="p-3 flex items-center gap-3">
              <div className="w-7 text-center font-bold text-primary">{idx + 1}</div>
              <PlayerAvatar name={row.name} src={row.avatar_url} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.position || "Sem posição"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">
                  {metric === "avgRating" ? Number(row.avgRating ?? 0).toFixed(1) : Number(row[metric] ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">variação: -</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
