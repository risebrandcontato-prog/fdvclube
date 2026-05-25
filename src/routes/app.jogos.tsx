import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGames } from "@/lib/games.functions";
import { GameCard } from "@/components/GameCard";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/app/jogos")({
  component: JogosPage,
});

function JogosPage() {
  const { player } = useSession();
  const fn = useServerFn(listGames);
  const { data, isLoading } = useQuery({ queryKey: ["games"], queryFn: () => fn() });

  const today = new Date().toISOString().slice(0, 10);
  const games = data?.games ?? [];
  const upcoming = games.filter((g) => g.date >= today);
  const past = games.filter((g) => g.date < today);

  function myStatus(gameId: string): "confirmed" | "cancelled" | "none" {
    const c = data?.confirmations.find((x) => x.game_id === gameId && x.player_id === player?.id);
    return (c?.status as "confirmed" | "cancelled") ?? "none";
  }
  function countFor(gameId: string) {
    return data?.confirmations.filter((c) => c.game_id === gameId && c.status === "confirmed").length ?? 0;
  }

  return (
    <div className="px-4 py-4 space-y-6">
      <h1 className="text-2xl font-bold">Jogos</h1>
      {isLoading ? <div className="text-sm text-muted-foreground">Carregando...</div> : null}

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Próximos</h2>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p> : null}
        {upcoming.map((g) => (
          <GameCard
            key={g.id}
            id={g.id}
            title={g.title}
            date={g.date}
            time={g.time}
            locationName={g.locations?.name}
            confirmedCount={countFor(g.id)}
            maxPlayers={g.max_players}
            myStatus={myStatus(g.id)}
            linkTo={`/app/jogos/${g.id}`}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Anteriores</h2>
        {past.map((g) => (
          <GameCard
            key={g.id}
            id={g.id}
            title={g.title}
            date={g.date}
            time={g.time}
            locationName={g.locations?.name}
            confirmedCount={countFor(g.id)}
            maxPlayers={g.max_players}
            myStatus={myStatus(g.id)}
            linkTo={`/app/jogos/${g.id}`}
          />
        ))}
      </section>
    </div>
  );
}
