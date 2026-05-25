import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listGames, listLocations } from "@/lib/games.functions";
import { adminCreateGame } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/jogos")({
  component: AdminJogos,
});

function AdminJogos() {
  const games = useServerFn(listGames);
  const locs = useServerFn(listLocations);
  const create = useServerFn(adminCreateGame);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["games"], queryFn: () => games() });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => locs() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "Jogo da semana",
    date: new Date().toISOString().slice(0, 10),
    time: "20:00",
    location_id: "" as string,
    max_players: 14,
    contribution_amount: 30,
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...form, location_id: form.location_id || null } });
      toast.success("Jogo criado!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["games"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jogos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-sm">
            <DialogHeader><DialogTitle>Novo jogo</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Hora</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5">
                <Label>Campo</Label>
                <select
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Máx. jogadores</Label><Input type="number" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: Number(e.target.value) })} /></div>
                <div className="grid gap-1.5"><Label>Valor R$</Label><Input type="number" step="0.01" value={form.contribution_amount} onChange={(e) => setForm({ ...form, contribution_amount: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(data?.games ?? []).map((g) => (
          <Link key={g.id} to={`/admin/jogos/${g.id}`}>
            <Card className="bg-card p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{g.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(`${g.date}T${g.time}`).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{g.locations?.name ?? "Sem campo"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{g.status}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
