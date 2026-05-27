import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Goal, Handshake, Star, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getPlayerPublicProfile } from "@/lib/games.functions";

export const Route = createFileRoute("/app/jogadores/$id")({
  component: PlayerPublicProfilePage,
});

function PlayerPublicProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const profileFn = useServerFn(getPlayerPublicProfile);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["player-public-profile", id],
    queryFn: () => profileFn({ data: { playerId: id } }),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded bg-muted animate-pulse" />
        <div className="h-48 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-5 text-center space-y-3">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar perfil do jogador."}
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/app/jogos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  if (!data?.player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-5 text-center space-y-3">
          <p className="text-sm">Jogador não encontrado.</p>
          <Button variant="outline" onClick={() => navigate({ to: "/app/jogos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  const stats = data.stats;
  return (
    <div className="px-4 py-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/jogos" })} className="px-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <PlayerAvatar name={data.player.name} src={data.player.avatar_url} className="h-24 w-24 ring-2 ring-primary/40" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{data.player.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{data.player.position || "Sem posição definida"}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Gols</p>
          <p className="text-xl font-bold inline-flex items-center gap-1">
            <Goal className="h-4 w-4 text-emerald-400" />
            {stats?.totalGoals ?? 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Assistências</p>
          <p className="text-xl font-bold inline-flex items-center gap-1">
            <Handshake className="h-4 w-4 text-sky-400" />
            {stats?.totalAssists ?? 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Jogos</p>
          <p className="text-xl font-bold inline-flex items-center gap-1">
            <Trophy className="h-4 w-4 text-amber-400" />
            {stats?.totalGames ?? 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Nota média</p>
          <p className="text-xl font-bold inline-flex items-center gap-1">
            <Star className="h-4 w-4 text-primary" />
            {stats?.averageRating ? stats.averageRating.toFixed(1) : "-"}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-2">Jogos recentes</h2>
        {(data.recentGames ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem histórico recente.</p>
        ) : (
          <div className="space-y-2">
            {data.recentGames.map((game) => (
              <div key={game.id} className="rounded-md border border-border/60 p-2.5">
                <p className="font-medium text-sm">{game.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${game.date}T${game.time}`).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
