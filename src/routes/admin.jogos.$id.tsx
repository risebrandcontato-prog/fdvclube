import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Volleyball,
  Shirt,
  Check,
  X,
  Ban,
  Award,
  Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminGameDetail,
  adminSetConfirmation,
  adminSetPayment,
  adminUpdateGame,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogos/$id")({
  component: AdminGameDetailPage,
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await queryClient.ensureQueryData({
      queryKey: ["adminGame", id],
      queryFn: () => adminGameDetail({ data: { id } }),
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

const paymentConfig: Record<string, { label: string; cls: string; icon: any }> = {
  paid: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Check },
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertCircle },
  late: { label: "Atrasado", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: Ban },
  exempt: { label: "Isento", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Award },
};

const vestsLabel: Record<string, string> = {
  none: "Nenhum",
  orange: "Laranja",
  black: "Preto",
  both: "Laranja + Preto",
};

function AdminGameDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const detailFn = useServerFn(adminGameDetail);
  const confirmFn = useServerFn(adminSetConfirmation);
  const paymentFn = useServerFn(adminSetPayment);
  const updateFn = useServerFn(adminUpdateGame);

  const { data, isLoading } = useQuery({
    queryKey: ["adminGame", id],
    queryFn: () => detailFn({ data: { id } }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const game = data?.game;
  const location = data?.location;
  const players = (data?.players ?? []) as any[];
  const confirmations = (data?.confirmations ?? []) as any[];
  const payments = (data?.payments ?? []) as any[];

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    date: "",
    time: "",
    location_id: "",
    max_players: 14,
    contribution_amount: 30,
    notes: "",
    has_ball: false,
    vests: "none" as "none" | "orange" | "black" | "both",
  });

  const confirmedList = confirmations.filter((c: any) => c.status === "confirmed");
  const cancelledList = confirmations.filter((c: any) => c.status === "cancelled");

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

  const st = statusConfig[game?.status ?? "scheduled"];

  const totalPaid = payments
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
  const totalPending = payments
    .filter((p: any) => p.status === "pending" || p.status === "late")
    .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);

  function getPlayerConf(playerId: string) {
    return confirmations.find((c: any) => c.player_id === playerId);
  }

  function getPlayerPayment(playerId: string) {
    return payments.find((p: any) => p.player_id === playerId);
  }

  async function togglePlayerConf(playerId: string, current: string | undefined) {
    const next = current === "confirmed" ? "cancelled" : "confirmed";
    try {
      await confirmFn({ data: { gameId: id, playerId, status: next } });
      toast.success(next === "confirmed" ? "Presença confirmada" : "Presença cancelada");
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) {
      toast.error("Erro ao atualizar presença");
    }
  }

  async function setPaymentStatus(playerId: string, status: "paid" | "pending" | "late" | "exempt") {
    try {
      await paymentFn({ data: { gameId: id, playerId, status } });
      toast.success(`Pagamento: ${paymentConfig[status].label}`);
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) {
      toast.error("Erro ao atualizar pagamento");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateFn({
        data: {
          id,
          ...editForm,
          location_id: editForm.location_id || null,
        },
      });
      toast.success("Jogo atualizado!");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["adminGame", id] });
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function openEdit() {
    if (!game) return;
    setEditForm({
      title: game.title,
      date: game.date,
      time: game.time,
      location_id: game.location_id ?? "",
      max_players: game.max_players,
      contribution_amount: game.contribution_amount,
      notes: game.notes ?? "",
      has_ball: game.has_ball ?? false,
      vests: game.vests ?? "none",
    });
    setEditOpen(true);
  }

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-64 bg-muted animate-pulse" />
        <div className="px-4 py-6 space-y-4">
          <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ===== HERO ===== */}
      <div className="relative h-56 w-full overflow-hidden">
        {location?.photo_url ? (
          <img src={location.photo_url} alt={location.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-emerald-900 to-zinc-900 flex items-center justify-center">
            <MapPin className="h-12 w-12 text-emerald-500/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Link
            to="/admin/jogos"
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border/50 hover:bg-background transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <button
            onClick={openEdit}
            className="h-9 px-3 rounded-full bg-background/80 backdrop-blur flex items-center gap-1.5 border border-border/50 hover:bg-background transition-colors text-xs font-medium"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {game.has_ball && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                <Volleyball className="h-3 w-3" />
                Tem bola
              </span>
            )}
            {game.vests && game.vests !== "none" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Shirt className="h-3 w-3" />
                {vestsLabel[game.vests]}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold leading-tight">{game.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
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
        {/* ===== RESUMO FINANCEIRO ===== */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center border border-border/80">
            <div className="text-lg font-bold text-emerald-400">
              R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Recebido</div>
          </Card>
          <Card className="p-3 text-center border border-border/80">
            <div className="text-lg font-bold text-amber-400">
              R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Pendente</div>
          </Card>
          <Card className="p-3 text-center border border-border/80">
            <div className="text-lg font-bold text-primary">
              {confirmedCount}/{max}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Confirmados</div>
          </Card>
        </div>

        {/* ===== VAGAS ===== */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Vagas
            </h2>
            <span className="text-xs text-muted-foreground">
              {vacanciesLeft > 0
                ? `${vacanciesLeft} restante${vacanciesLeft > 1 ? "s" : ""}`
                : "Lotado"}
            </span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                vacanciesLeft === 0 ? "bg-red-400" : vacanciesLeft <= 2 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${vacancyRate}%` }}
            />
          </div>
        </section>

        {/* ===== LISTA DE JOGADORES ===== */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            Jogadores ({players.length})
          </h2>

          <div className="space-y-2">
            {players.map((p: any) => {
              const conf = getPlayerConf(p.id);
              const pay = getPlayerPayment(p.id);
              const confStatus = conf?.status;
              const payStatus = pay?.status ?? "pending";
              const payCfg = paymentConfig[payStatus];

              return (
                <Card
                  key={p.id}
                  className={`p-3 border ${
                    confStatus === "confirmed"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : confStatus === "cancelled"
                      ? "border-red-500/20 bg-red-500/5 opacity-60"
                      : "border-border/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground">{p.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        {p.is_blocked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Confirmação */}
                        <button
                          onClick={() => togglePlayerConf(p.id, confStatus)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                            confStatus === "confirmed"
                              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : confStatus === "cancelled"
                              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          }`}
                        >
                          {confStatus === "confirmed" ? (
                            <CircleCheck className="h-3 w-3" />
                          ) : confStatus === "cancelled" ? (
                            <CircleX className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {confStatus === "confirmed" ? "Vai" : confStatus === "cancelled" ? "Não vai" : "Pendente"}
                        </button>

                        {/* Pagamento */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${payCfg.cls}`}
                        >
                          <payCfg.icon className="h-3 w-3" />
                          {payCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Ações de pagamento */}
                    <div className="flex flex-col gap-1">
                      {payStatus !== "paid" && (
                        <button
                          onClick={() => setPaymentStatus(p.id, "paid")}
                          className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                          title="Marcar como pago"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {payStatus === "paid" && (
                        <button
                          onClick={() => setPaymentStatus(p.id, "pending")}
                          className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                          title="Marcar como pendente"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ações rápidas de pagamento */}
                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/30">
                    <button
                      onClick={() => setPaymentStatus(p.id, "paid")}
                      className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
                        payStatus === "paid"
                          ? "bg-emerald-500 text-white"
                          : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      Pago
                    </button>
                    <button
                      onClick={() => setPaymentStatus(p.id, "pending")}
                      className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
                        payStatus === "pending"
                          ? "bg-amber-500 text-white"
                          : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      }`}
                    >
                      Pendente
                    </button>
                    <button
                      onClick={() => setPaymentStatus(p.id, "late")}
                      className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
                        payStatus === "late"
                          ? "bg-red-500 text-white"
                          : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      }`}
                    >
                      Atrasado
                    </button>
                    <button
                      onClick={() => setPaymentStatus(p.id, "exempt")}
                      className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
                        payStatus === "exempt"
                          ? "bg-blue-500 text-white"
                          : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      }`}
                    >
                      Isento
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ===== CAMPO ===== */}
        <Card className="p-4 space-y-3 border border-border/80">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Local
          </h2>
          <div>
            <p className="text-sm font-medium">{location?.name ?? "Sem campo definido"}</p>
            {location?.address && <p className="text-xs text-muted-foreground mt-0.5">{location.address}</p>}
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
                R$ {(game.contribution_amount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Volleyball className="h-3.5 w-3.5" />
                Bola
              </span>
              <span className="text-sm font-medium">{game.has_ball ? "Sim" : "Não"}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Shirt className="h-3.5 w-3.5" />
                Coletes
              </span>
              <span className="text-sm font-medium">{vestsLabel[game.vests ?? "none"]}</span>
            </div>
            {game.notes && (
              <div className="pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  Observações
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed">{game.notes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ===== DIALOG EDITAR ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar jogo</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Título</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Data</Label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} required />
              </div>
              <div className="grid gap-1.5">
                <Label>Hora</Label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Máx. jogadores</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={editForm.max_players}
                onChange={(e) => setEditForm({ ...editForm, max_players: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor R$</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={editForm.contribution_amount}
                onChange={(e) => setEditForm({ ...editForm, contribution_amount: Number(e.target.value) })}
              />
            </div>

            {/* BOLA */}
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
              <Volleyball className="h-4 w-4 text-primary" />
              <Label className="text-sm flex-1">Tem bola?</Label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, has_ball: !editForm.has_ball })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editForm.has_ball ? "bg-emerald-500" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editForm.has_ball ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* COLETES */}
            <div className="grid gap-1.5">
              <Label className="inline-flex items-center gap-1.5">
                <Shirt className="h-4 w-4 text-primary" />
                Coletes disponíveis
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "none", label: "Nenhum" },
                  { value: "orange", label: "Laranja" },
                  { value: "black", label: "Preto" },
                  { value: "both", label: "Ambos" },
                ] as const).map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, vests: v.value })}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      editForm.vests === v.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-card text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <Button type="submit" className="bg-gradient-primary text-primary-foreground">
              Salvar alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}