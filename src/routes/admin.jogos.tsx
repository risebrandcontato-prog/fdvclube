import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Volleyball, Shirt, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { adminListGames, adminListLocations, adminCreateGame, adminDeleteGame } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogos")({
  component: AdminJogos,
  loader: async ({ context: { queryClient } }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: ["games"],
        queryFn: () => adminListGames(),
        staleTime: 1000 * 60 * 5,
      });
      await queryClient.ensureQueryData({
        queryKey: ["locations"],
        queryFn: () => adminListLocations(),
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
};

const vestsLabel: Record<string, string> = {
  none: "Nenhum",
  orange: "Laranja",
  black: "Preto",
  both: "Laranja + Preto",
};

function AdminJogos() {
  const location = useLocation();
  if (location.pathname !== "/admin/jogos") {
    return <Outlet />;
  }

  const gamesFn = useServerFn(adminListGames);
  const locsFn = useServerFn(adminListLocations);
  const createFn = useServerFn(adminCreateGame);
  const deleteFn = useServerFn(adminDeleteGame);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: () => gamesFn(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locsFn(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "Jogo da semana",
    date: new Date().toISOString().slice(0, 10),
    time: "20:00",
    location_id: "" as string,
    max_players: 14,
    contribution_amount: 30,
    notes: "",
    has_ball: false,
    vests: "none" as "none" | "orange" | "black" | "both",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      toast.error("Data inválida.");
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.time)) {
      toast.error("Hora inválida.");
      return;
    }
    try {
      await createFn({ data: { ...form, location_id: form.location_id || null } });
      toast.success("Jogo criado!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["games"] });
      setForm({
        title: "Jogo da semana",
        date: new Date().toISOString().slice(0, 10),
        time: "20:00",
        location_id: "",
        max_players: 14,
        contribution_amount: 30,
        notes: "",
        has_ball: false,
        vests: "none",
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function doDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este jogo permanentemente?")) return;
    setDeletingId(id);
    try {
      await deleteFn({ data: { id } });
      toast.success("Jogo excluído");
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setDeletingId(null); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const games = data?.games ?? [];
  const confirmations = data?.confirmations ?? [];
  const confirmedByGame = confirmations.reduce((acc: Record<string, number>, c: any) => {
    if (c.status === "confirmed") acc[c.game_id] = (acc[c.game_id] ?? 0) + 1;
    return acc;
  }, {});
  const upcoming = games.filter((g: any) => g.date >= today && g.status !== "cancelled");
  const past = games.filter((g: any) => g.date < today || g.status === "done" || g.status === "cancelled");

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold">Jogos</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo jogo</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="grid gap-1.5"><Label>Hora</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></div>
              </div>
              <div className="grid gap-1.5">
                <Label>Campo</Label>
                <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {(locations?.data ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Máx. jogadores</Label><Input type="number" min={1} max={50} value={form.max_players} onChange={(e) => setForm({ ...form, max_players: Number(e.target.value) })} /></div>
                <div className="grid gap-1.5"><Label>Valor R$</Label><Input type="number" step="0.01" min={0} value={form.contribution_amount} onChange={(e) => setForm({ ...form, contribution_amount: Number(e.target.value) })} /></div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
                <Volleyball className="h-4 w-4 text-primary" />
                <Label className="text-sm flex-1">Tem bola?</Label>
                <button type="button" onClick={() => setForm({ ...form, has_ball: !form.has_ball })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.has_ball ? "bg-emerald-500" : "bg-muted"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.has_ball ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="grid gap-1.5">
                <Label className="inline-flex items-center gap-1.5"><Shirt className="h-4 w-4 text-primary" />Coletes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ value: "none", label: "Nenhum" }, { value: "orange", label: "Laranja" }, { value: "black", label: "Preto" }, { value: "both", label: "Ambos" }] as const).map((v) => (
                    <button key={v.value} type="button" onClick={() => setForm({ ...form, vests: v.value })} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${form.vests === v.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground hover:border-primary/30"}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="bg-primary text-primary-foreground">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Próximos</h2>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-20 bg-muted rounded-lg animate-pulse" />
            <div className="h-20 bg-muted rounded-lg animate-pulse" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p>
        ) : (
          upcoming.map((g: any) => {
            const st = statusConfig[g.status] ?? statusConfig.scheduled;
            return (
              <Link key={g.id} to="/admin/jogos/$id" params={{ id: g.id }} className="block">
                <Card className="bg-card p-4 hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold">{g.title}</div>
                        <div className="flex items-center gap-1">
                          {g.has_ball && <Volleyball className="h-3.5 w-3.5 text-primary" />}
                          {g.vests && g.vests !== "none" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{vestsLabel[g.vests]}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(`${g.date}T${g.time}`).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{g.locations?.name ?? "Sem campo"}
                        {" · "}{g.max_players} vagas
                        {" · "}{confirmedByGame[g.id] ?? 0} confirmados
                        {g.result ? ` · Placar ${g.result.score_a ?? 0} x ${g.result.score_b ?? 0}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); doDelete(g.id); }} disabled={deletingId === g.id}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Anteriores / Cancelados</h2>
        {past.map((g: any) => {
          const st = statusConfig[g.status] ?? statusConfig.scheduled;
          return (
            <Link key={g.id} to="/admin/jogos/$id" params={{ id: g.id }} className="block">
              <Card className="bg-card p-4 opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{g.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(`${g.date}T${g.time}`).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{g.locations?.name ?? "Sem campo"}
                      {" · "}{g.max_players} vagas
                      {" · "}{confirmedByGame[g.id] ?? 0} confirmados
                      {g.result ? ` · Placar ${g.result.score_a ?? 0} x ${g.result.score_b ?? 0}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); doDelete(g.id); }} disabled={deletingId === g.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
