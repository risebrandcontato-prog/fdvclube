import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Clock, MapPin, Users, CreditCard,
  CircleCheck, CircleX, AlertCircle, Navigation, Banknote,
  StickyNote, Volleyball, Shirt, Check, X, Ban, Award,
  Pencil, Trophy, Swords, Shuffle, Trash2, ChevronDown,
  ChevronUp, Goal, Star, Medal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CountdownTimer } from "@/components/CountdownTimer";
import { PaymentBadge } from "@/components/PaymentBadge";
import {
  adminGameDetail, adminSetConfirmation, adminSetPayment,
  adminUpdateGame, saveGameStats, generateTeams, deleteTeams, adminSetResult,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogos/$id")({
  component: AdminGameDetailPage,
  loader: async ({ context: { queryClient }, params: { id } }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: ["adminGame", id],
        queryFn: () => adminGameDetail({ data: { id } }),
        staleTime: 1000 * 60 * 5,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        throw redirect({ to: "/admin/login" });
      }
      throw error;
    }
  },
});

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  scheduled: { label: "Agendado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelado", cls: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-400" },
  done: { label: "Realizado", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", dot: "bg-zinc-400" },
  finished: { label: "Realizado", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", dot: "bg-zinc-400" },
};

const vestsLabel: Record<string, string> = {
  none: "Nenhum", orange: "Laranja", black: "Preto", both: "Laranja + Preto",
};

function AdminGameDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const detailFn = useServerFn(adminGameDetail);
  const confirmFn = useServerFn(adminSetConfirmation);
  const paymentFn = useServerFn(adminSetPayment);
  const updateFn = useServerFn(adminUpdateGame);
  const saveStatsFn = useServerFn(saveGameStats);
  const generateTeamsFn = useServerFn(generateTeams);
  const deleteTeamsFn = useServerFn(deleteTeams);
  const setResultFn = useServerFn(adminSetResult);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["adminGame", id],
    queryFn: () => detailFn({ data: { id } }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const game = data?.game as Record<string, any> | undefined;
  const location = data?.location as Record<string, any> | undefined;
  const players = (data?.players ?? []) as Array<Record<string, any>>;
  const confirmations = (data?.confirmations ?? []) as Array<Record<string, any>>;
  const payments = (data?.payments ?? []) as Array<Record<string, any>>;
  const gameStats = (data?.stats ?? []) as Array<Record<string, any>>;
  const gameResult = data?.result as Record<string, any> | undefined;
  const teams = (data?.teams ?? []) as Array<Record<string, any>>;

  const [editOpen, setEditOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [statsSaving, setStatsSaving] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [showTeams, setShowTeams] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showPlayers, setShowPlayers] = useState(true);
  const [editForm, setEditForm] = useState({
    title: "", date: "", time: "", location_id: "",
    max_players: 14, contribution_amount: 30, notes: "",
    has_ball: false, vests: "none" as "none" | "orange" | "black" | "both",
    formation_config: null as Record<string, any> | null, auto_draw: false,
  });
  const [statsForm, setStatsForm] = useState<Record<string, Record<string, any>>>({});
  const [resultForm, setResultForm] = useState({ score_a: 0, score_b: 0, mvp_id: "" as string });

  const confirmedList = confirmations.filter((c) => c.status === "confirmed");
  const cancelledList = confirmations.filter((c) => c.status === "cancelled");

  const max = typeof game?.max_players === "number" ? game.max_players : 1;
  const confirmedCount = confirmedList.length;
  const vacancyRate = Math.min(100, (confirmedCount / max) * 100);
  const vacanciesLeft = Math.max(0, max - confirmedCount);

  const gameDateTime = game ? `${game.date}T${game.time}` : "";
  const dateObj = game ? new Date(gameDateTime) : null;
  const day = dateObj?.getDate();
  const month = dateObj?.toLocaleString("pt-BR", { month: "short" });
  const weekday = dateObj?.toLocaleString("pt-BR", { weekday: "long" });
  const timeStr = dateObj?.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const gameStatus = String(game?.status ?? "scheduled");
  const isFinished = gameStatus === "done" || gameStatus === "finished";
  const st = statusConfig[gameStatus] ?? statusConfig.scheduled;

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((sum: number, p) => sum + Number(p.amount ?? 0), 0);
  const totalPending = payments.filter((p) => p.status === "pending" || p.status === "late").reduce((sum: number, p) => sum + Number(p.amount ?? 0), 0);

  function getPlayerConf(playerId: string) { return confirmations.find((c) => c.player_id === playerId); }
  function getPlayerPayment(playerId: string) { return payments.find((p) => p.player_id === playerId); }

  async function togglePlayerConf(playerId: string, current: string | undefined) {
    const next = current === "confirmed" ? "cancelled" : "confirmed";
    try {
      await confirmFn({ data: { gameId: id, playerId, status: next } });
      toast.success(next === "confirmed" ? "Presença confirmada" : "Presença cancelada");
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error("Erro ao atualizar presença"); }
  }

  async function setPaymentStatus(playerId: string, status: "paid" | "pending" | "late" | "exempt") {
    try {
      await paymentFn({ data: { gameId: id, playerId, status } });
      toast.success(`Pagamento atualizado`);
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error("Erro ao atualizar pagamento"); }
  }

  async function handleGenerateTeams() {
    if (confirmedList.length === 0) { toast.error("Nenhum jogador confirmado para sortear times."); return; }
    try {
      setTeamsLoading(true);
      const numTeams = confirmedList.length >= 18 ? 3 : 2;
      const result = await generateTeamsFn({ data: { gameId: id, numTeams } });
      if (result.success) { toast.success("Times sorteados com sucesso!"); qc.invalidateQueries({ queryKey: ["adminGame", id] }); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao sortear times"); }
    finally { setTeamsLoading(false); }
  }

  async function handleDeleteTeams() {
    try {
      setTeamsLoading(true);
      await deleteTeamsFn({ data: { gameId: id } });
      toast.success("Times removidos.");
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
    } catch (e) { toast.error("Erro ao remover times"); }
    finally { setTeamsLoading(false); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateFn({ data: { id, ...editForm, location_id: editForm.location_id || null } });
      toast.success("Jogo atualizado!"); setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function saveResult(e: React.FormEvent) {
    e.preventDefault();
    try {
      await setResultFn({ data: { gameId: id, score_a: resultForm.score_a, score_b: resultForm.score_b, mvp_id: resultForm.mvp_id || null } });
      toast.success("Resultado salvo! Jogo marcado como realizado.");
      setResultOpen(false);
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar resultado"); }
  }

  function openEdit() {
    if (!game) return;
    setEditForm({
      title: String(game.title ?? ""), date: String(game.date ?? ""), time: String(game.time ?? ""),
      location_id: String(game.location_id ?? ""), max_players: Number(game.max_players ?? 14),
      contribution_amount: Number(game.contribution_amount ?? 0), notes: String(game.notes ?? ""),
      has_ball: Boolean(game.has_ball ?? false), vests: (game.vests as any) ?? "none",
      formation_config: (game.formation_config as any) ?? null, auto_draw: Boolean(game.auto_draw ?? false),
    });
    setEditOpen(true);
  }

  function openResult() {
    if (!gameResult) setResultForm({ score_a: 0, score_b: 0, mvp_id: "" });
    else setResultForm({ score_a: Number(gameResult.score_a ?? 0), score_b: Number(gameResult.score_b ?? 0), mvp_id: String(gameResult.mvp_player_id ?? "") });
    setResultOpen(true);
  }

  function getStat(playerId: string) {
    return statsForm[playerId] ?? { goals: 0, assists: 0, own_goals: 0, yellow_cards: 0, red_cards: 0, rating: null as number | null, notes: "" };
  }
  function updateStat(playerId: string, patch: Record<string, any>) { setStatsForm((prev) => ({ ...prev, [playerId]: { ...getStat(playerId), ...patch } })); }

  async function onSaveStats() {
    const confirmedPlayerIds = confirmedList.map((c) => c.player_id as string);
    const payload = confirmedPlayerIds.map((playerId) => {
      const stat = getStat(playerId);
      return { playerId, goals: Number(stat.goals || 0), assists: Number(stat.assists || 0), own_goals: Number(stat.own_goals || 0), yellow_cards: Number(stat.yellow_cards || 0), red_cards: Number(stat.red_cards || 0), rating: stat.rating ? Number(stat.rating) : null, notes: stat.notes?.trim() ? stat.notes.trim() : null };
    });
    try {
      setStatsSaving(true);
      const result = await saveStatsFn({ data: { gameId: id, stats: payload } });
      if (!result.success) { toast.error(result.error ?? "Erro ao salvar estatísticas."); return; }
      toast.success("Estatísticas salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar estatísticas"); }
    finally { setStatsSaving(false); }
  }

  useEffect(() => {
    if (gameStats.length === 0) return;
    const initial: Record<string, Record<string, any>> = {};
    for (const stat of gameStats) {
      initial[stat.player_id as string] = { goals: Number(stat.goals ?? 0), assists: Number(stat.assists ?? 0), own_goals: Number(stat.own_goals ?? 0), yellow_cards: Number(stat.yellow_cards ?? 0), red_cards: Number(stat.red_cards ?? 0), rating: stat.rating != null ? Number(stat.rating) : null, notes: String(stat.notes ?? "") };
    }
    setStatsForm(initial);
  }, [gameStats]);

  if (isLoading) return (<div className="min-h-screen bg-background"><div className="h-56 bg-muted animate-pulse" /><div className="px-4 py-6 space-y-4"><div className="h-6 w-2/3 bg-muted rounded animate-pulse" /><div className="h-32 bg-muted rounded animate-pulse" /></div></div>);
  if (isError) return (<div className="min-h-screen bg-background flex items-center justify-center px-4"><Card className="w-full max-w-md p-5 text-center space-y-3"><p className="text-sm text-destructive font-medium">{error instanceof Error ? error.message : "Erro ao carregar detalhes do jogo."}</p><Link to="/admin/jogos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Voltar para jogos</Link></Card></div>);
  if (!game) return (<div className="min-h-screen bg-background flex items-center justify-center px-4"><Card className="w-full max-w-md p-5 text-center space-y-3"><p className="text-sm font-medium">Jogo não encontrado.</p><Link to="/admin/jogos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Voltar para jogos</Link></Card></div>);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* HERO */}
      <div className="relative h-56 w-full overflow-hidden">
        {location?.photo_url ? (
          <img src={location.photo_url as string} alt={location.name as string} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-emerald-900 to-zinc-900 flex items-center justify-center"><MapPin className="h-12 w-12 text-emerald-500/30" /></div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link to="/admin/jogos" className="h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border/50 hover:bg-background transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
          <button onClick={openEdit} className="h-9 px-3 rounded-full bg-background/80 backdrop-blur flex items-center gap-1.5 border border-border/50 hover:bg-background transition-colors text-xs font-medium"><Pencil className="h-3.5 w-3.5" />Editar</button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
            {game.has_ball && (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"><Volleyball className="h-3 w-3" />Tem bola</span>)}
            {game.vests && game.vests !== "none" && (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Shirt className="h-3 w-3" />{vestsLabel[game.vests as string]}</span>)}
          </div>
          <h1 className="text-2xl font-bold leading-tight">{game.title as string}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{day} {month} · {weekday}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeStr}</span>
            <CountdownTimer targetDate={gameDateTime} />
          </div>
        </div>
      </div>

      <div className="px-4 py-2 space-y-6">
        {/* RESUMO FINANCEIRO */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center border border-border/80"><div className="text-lg font-bold text-emerald-400">R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Recebido</div></Card>
          <Card className="p-3 text-center border border-border/80"><div className="text-lg font-bold text-amber-400">R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Pendente</div></Card>
          <Card className="p-3 text-center border border-border/80"><div className="text-lg font-bold text-primary">{confirmedCount}/{max}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Confirmados</div></Card>
        </div>

        {/* AÇÕES RÁPIDAS */}
        <div className="flex gap-2 flex-wrap">
          {!isFinished && teams.length === 0 && confirmedList.length > 0 && (
            <Button onClick={handleGenerateTeams} disabled={teamsLoading} className="bg-blue-600 hover:bg-blue-700"><Shuffle className="h-4 w-4 mr-1.5" />{teamsLoading ? "Sorteando..." : "Sortear Times"}</Button>
          )}
          {teams.length > 0 && !isFinished && (
            <>
              <Button onClick={openResult} className="bg-amber-600 hover:bg-amber-700"><Trophy className="h-4 w-4 mr-1.5" />Definir Placar</Button>
              <Button onClick={handleDeleteTeams} disabled={teamsLoading} variant="outline" className="text-red-400"><Trash2 className="h-4 w-4 mr-1.5" />Refazer Times</Button>
            </>
          )}
          {isFinished && gameResult && (
            <Card className="flex-1 p-3 bg-linear-to-r from-amber-500/10 to-yellow-500/5 border-amber-500/20">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center"><div className="text-xs text-muted-foreground">Time A</div><div className="text-2xl font-black">{gameResult.score_a ?? 0}</div></div>
                <div className="text-muted-foreground font-bold">x</div>
                <div className="text-center"><div className="text-xs text-muted-foreground">Time B</div><div className="text-2xl font-black">{gameResult.score_b ?? 0}</div></div>
                {gameResult.mvp_player_id && (<div className="flex items-center gap-1 text-xs text-amber-400"><Star className="h-3.5 w-3.5" />MVP</div>)}
              </div>
            </Card>
          )}
        </div>

        {/* VAGAS */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />Vagas</h2>
            <span className="text-xs text-muted-foreground">{vacanciesLeft > 0 ? `${vacanciesLeft} restante${vacanciesLeft > 1 ? "s" : ""}` : "Lotado"}</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${vacanciesLeft === 0 ? "bg-red-400" : vacanciesLeft <= 2 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${vacancyRate}%` }} /></div>
        </section>

        {/* TIMES */}
        <Card className="border border-border/80 overflow-hidden">
          <button onClick={() => setShowTeams(!showTeams)} className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Times</h2>{teams.length > 0 && (<span className="text-xs text-muted-foreground">({teams.length} times)</span>)}</div>
            <div className="flex items-center gap-2">
              {teams.length === 0 && confirmedList.length > 0 && (<Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleGenerateTeams(); }} disabled={teamsLoading} className="h-7 text-xs"><Shuffle className="h-3 w-3 mr-1" />{teamsLoading ? "Sorteando..." : "Sortear"}</Button>)}
              {teams.length > 0 && (<Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDeleteTeams(); }} disabled={teamsLoading} className="h-7 text-xs text-red-400 hover:text-red-500"><Trash2 className="h-3 w-3 mr-1" />Refazer</Button>)}
              {showTeams ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>
          {showTeams && (
            <div className="px-4 pb-4">
              {teams.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground"><Swords className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Times ainda não sorteados</p><p className="text-xs mt-1">Clique em "Sortear" para formar os times automaticamente</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {teams.map((team: any) => (
                    <div key={team.id} className="rounded-lg border p-3" style={{ borderColor: team.color ? `${team.color}40` : undefined, backgroundColor: team.color ? `${team.color}10` : undefined }}>
                      <div className="flex items-center gap-2 mb-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color ?? "#666" }} /><h3 className="text-sm font-bold">{team.team_name}</h3><span className="text-xs text-muted-foreground">({(team.player_ids ?? []).length} jogadores)</span></div>
                      <div className="space-y-1.5">
                        {(team.player_ids ?? []).map((playerId: string) => {
                          const p = players.find((pl) => pl.id === playerId);
                          return (<div key={playerId} className="flex items-center gap-2 text-xs"><div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">{p?.avatar_url ? (<img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />) : (<span>{String(p?.name ?? "?").charAt(0).toUpperCase()}</span>)}</div><span className="font-medium">{p?.name ?? "Jogador"}</span>{p?.preferred_position && (<span className="text-muted-foreground">({p.preferred_position})</span>)}</div>);
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* LISTA DE JOGADORES */}
        <Card className="border border-border/80 overflow-hidden">
          <button onClick={() => setShowPlayers(!showPlayers)} className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Jogadores ({players.length})</h2></div>
            {showPlayers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPlayers && (
            <div className="px-4 pb-4 space-y-2">
              {players.map((p) => {
                const conf = getPlayerConf(p.id as string);
                const pay = getPlayerPayment(p.id as string);
                const confStatus = conf?.status as string | undefined;
                const payStatus = (pay?.status as string) ?? "pending";
                return (
                  <div key={p.id as string} className={`p-3 rounded-lg border ${confStatus === "confirmed" ? "border-emerald-500/20 bg-emerald-500/5" : confStatus === "cancelled" ? "border-red-500/20 bg-red-500/5 opacity-60" : "border-border/50"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">{p.avatar_url ? (<img src={p.avatar_url as string} alt={p.name as string} className="w-full h-full object-cover" />) : (<span className="text-muted-foreground">{String(p.name ?? "?").charAt(0).toUpperCase()}</span>)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium truncate">{p.name as string}</span>{p.is_blocked && (<span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">Bloqueado</span>)}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <button onClick={() => togglePlayerConf(p.id as string, confStatus)} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${confStatus === "confirmed" ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : confStatus === "cancelled" ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"}`}>
                            {confStatus === "confirmed" ? <CircleCheck className="h-3 w-3" /> : confStatus === "cancelled" ? <CircleX className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {confStatus === "confirmed" ? "Confirmado" : confStatus === "cancelled" ? "Cancelado" : "Pendente"}
                          </button>
                          <PaymentBadge status={payStatus as any} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {payStatus !== "paid" && (<button onClick={() => setPaymentStatus(p.id as string, "paid")} className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors" title="Aprovar pagamento"><Check className="h-3.5 w-3.5" /></button>)}
                        {payStatus === "paid" && (<button onClick={() => setPaymentStatus(p.id as string, "pending")} className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center hover:bg-amber-500/20 transition-colors" title="Marcar como pendente"><AlertCircle className="h-3.5 w-3.5" /></button>)}
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/30">
                      <button onClick={() => setPaymentStatus(p.id as string, "paid")} className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${payStatus === "paid" ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>Pago</button>
                      <button onClick={() => setPaymentStatus(p.id as string, "pending")} className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${payStatus === "pending" ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"}`}>Pendente</button>
                      <button onClick={() => setPaymentStatus(p.id as string, "late")} className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${payStatus === "late" ? "bg-red-500 text-white" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}>Atrasado</button>
                      <button onClick={() => setPaymentStatus(p.id as string, "exempt")} className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${payStatus === "exempt" ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"}`}>Isento</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* CAMPO */}
        <Card className="p-4 space-y-3 border border-border/80">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />Local</h2>
          <div><p className="text-sm font-medium">{(location?.name as string) ?? "Sem campo definido"}</p>{location?.address && <p className="text-xs text-muted-foreground mt-0.5">{location.address as string}</p>}</div>
          {location?.maps_url && (<a href={location.maps_url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Navigation className="h-3.5 w-3.5" />Abrir no Google Maps</a>)}
        </Card>

        {/* INFORMAÇÕES */}
        <Card className="p-4 space-y-3 border border-border/80">
          <h2 className="text-sm font-semibold">Informações</h2>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5" />Contribuição</span><span className="text-sm font-bold">R$ {Number(game.contribution_amount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40"><span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Volleyball className="h-3.5 w-3.5" />Bola</span><span className="text-sm font-medium">{game.has_ball ? "Sim" : "Não"}</span></div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40"><span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Shirt className="h-3.5 w-3.5" />Coletes</span><span className="text-sm font-medium">{vestsLabel[(game.vests as string) ?? "none"]}</span></div>
            {game.formation_config && (<div className="flex items-center justify-between pt-2 border-t border-border/40"><span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" />Formação</span><span className="text-sm font-medium">{(game.formation_config as Record<string, any>)?.formation_desc ?? "Não definida"}</span></div>)}
            {game.notes && (<div className="pt-2 border-t border-border/40"><span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mb-1"><StickyNote className="h-3.5 w-3.5" />Observações</span><p className="text-xs text-foreground/80 leading-relaxed">{game.notes as string}</p></div>)}
          </div>
        </Card>

        {/* ESTATÍSTICAS */}
        <Card className="border border-border/80 overflow-hidden">
          <button onClick={() => setShowStats(!showStats)} className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Estatísticas</h2>{gameResult && (<span className="text-xs text-muted-foreground">Placar: {gameResult.score_a ?? 0} x {gameResult.score_b ?? 0}</span>)}</div>
            {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showStats && (
            <div className="px-4 pb-4">
              {confirmedList.length === 0 ? (<p className="text-sm text-muted-foreground py-4">Nenhum jogador confirmado para registrar estatísticas.</p>) : (
                <div className="space-y-3 mt-2">
                  {confirmedList.map((c) => {
                    const player = players.find((pl) => pl.id === c.player_id);
                    const stat = getStat(c.player_id as string);
                    return (
                      <div key={c.player_id as string} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex items-center gap-2"><Goal className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">{player?.name ?? "Jogador"}</p></div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" min={0} value={stat.goals} onChange={(e) => updateStat(c.player_id as string, { goals: Number(e.target.value) })} placeholder="Gols" />
                          <Input type="number" min={0} value={stat.assists} onChange={(e) => updateStat(c.player_id as string, { assists: Number(e.target.value) })} placeholder="Assist." />
                          <Input type="number" min={0} value={stat.own_goals} onChange={(e) => updateStat(c.player_id as string, { own_goals: Number(e.target.value) })} placeholder="Gol contra" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" min={0} value={stat.yellow_cards} onChange={(e) => updateStat(c.player_id as string, { yellow_cards: Number(e.target.value) })} placeholder="Amarelo" />
                          <Input type="number" min={0} value={stat.red_cards} onChange={(e) => updateStat(c.player_id as string, { red_cards: Number(e.target.value) })} placeholder="Vermelho" />
                          <Input type="number" min={1} max={10} value={stat.rating ?? ""} onChange={(e) => updateStat(c.player_id as string, { rating: e.target.value ? Number(e.target.value) : null })} placeholder="Nota 1-10" />
                        </div>
                        <Textarea value={stat.notes ?? ""} onChange={(e) => updateStat(c.player_id as string, { notes: e.target.value })} placeholder="Observações (opcional)" className="text-xs" />
                      </div>
                    );
                  })}
                  <Button onClick={onSaveStats} disabled={statsSaving} className="w-full">{statsSaving ? "Salvando..." : "Salvar Estatísticas"}</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* DIALOG EDITAR */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar jogo</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-3">
            <div className="grid gap-1.5"><Label>Título</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Data</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} required /></div>
              <div className="grid gap-1.5"><Label>Hora</Label><Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} required /></div>
            </div>
            <div className="grid gap-1.5"><Label>Máx. jogadores</Label><Input type="number" min={1} max={50} value={editForm.max_players} onChange={(e) => setEditForm({ ...editForm, max_players: Number(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label>Valor R$</Label><Input type="number" step="0.01" min={0} value={editForm.contribution_amount} onChange={(e) => setEditForm({ ...editForm, contribution_amount: Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
              <Volleyball className="h-4 w-4 text-primary" /><Label className="text-sm flex-1">Tem bola?</Label>
              <button type="button" onClick={() => setEditForm({ ...editForm, has_ball: !editForm.has_ball })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.has_ball ? "bg-emerald-500" : "bg-muted"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.has_ball ? "translate-x-6" : "translate-x-1"}`} /></button>
            </div>
            <div className="grid gap-1.5">
              <Label className="inline-flex items-center gap-1.5"><Shirt className="h-4 w-4 text-primary" />Coletes disponíveis</Label>
              <div className="grid grid-cols-2 gap-2">
                {([{ value: "none" as const, label: "Nenhum" }, { value: "orange" as const, label: "Laranja" }, { value: "black" as const, label: "Preto" }, { value: "both" as const, label: "Ambos" }]).map((v) => (
                  <button key={v.value} type="button" onClick={() => setEditForm({ ...editForm, vests: v.value })} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${editForm.vests === v.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground hover:border-primary/30"}`}>{v.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
              <Shuffle className="h-4 w-4 text-primary" /><Label className="text-sm flex-1">Sorteio automático?</Label>
              <button type="button" onClick={() => setEditForm({ ...editForm, auto_draw: !editForm.auto_draw })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.auto_draw ? "bg-emerald-500" : "bg-muted"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.auto_draw ? "translate-x-6" : "translate-x-1"}`} /></button>
            </div>
            <div className="grid gap-1.5"><Label>Observações</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG RESULTADO */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader><DialogTitle>Definir Placar</DialogTitle></DialogHeader>
          <form onSubmit={saveResult} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Time A</Label><Input type="number" min={0} value={resultForm.score_a} onChange={(e) => setResultForm({ ...resultForm, score_a: Number(e.target.value) })} /></div>
              <div className="grid gap-1.5"><Label>Time B</Label><Input type="number" min={0} value={resultForm.score_b} onChange={(e) => setResultForm({ ...resultForm, score_b: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-1.5">
              <Label>MVP</Label>
              <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={resultForm.mvp_id} onChange={(e) => setResultForm({ ...resultForm, mvp_id: e.target.value })}>
                <option value="">Selecione...</option>
                {confirmedList.map((c) => { const p = players.find((pl) => pl.id === c.player_id); return <option key={c.player_id} value={c.player_id}>{p?.name ?? "Jogador"}</option>; })}
              </select>
            </div>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700">Salvar Resultado</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
