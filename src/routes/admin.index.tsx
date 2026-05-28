import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, KeyRound, CalendarPlus, MapPin, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDashboard, adminUpdateAppSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
  loader: async ({ context: { queryClient } }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: ["admin-dashboard"],
        queryFn: () => adminDashboard(),
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

function AdminHome() {
  const fn = useServerFn(adminDashboard);
  const { data } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });
  const saveSettings = useServerFn(adminUpdateAppSettings);
  const [whatsUrl, setWhatsUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWhatsUrl(String(data?.whatsapp_group_url ?? ""));
  }, [data?.whatsapp_group_url]);

  const shortcuts = [
    { to: "/admin/codigos", icon: KeyRound, label: "Códigos" },
    { to: "/admin/jogos", icon: CalendarPlus, label: "Jogos" },
    { to: "/admin/jogadores", icon: Users, label: "Jogadores" },
    { to: "/admin/campos", icon: MapPin, label: "Campos" },
  ];

  async function onSaveWhats() {
    try {
      setSaving(true);
      await saveSettings({ data: { whatsapp_group_url: whatsUrl.trim() ? whatsUrl.trim() : null } });
      toast.success("Link do WhatsApp atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>

      <Card className="bg-gradient-field p-5">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold">Próximo jogo</div>
        {data?.nextGame ? (
          <>
            <div className="text-lg font-bold mt-1">{data.nextGame.title}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(`${data.nextGame.date}T${data.nextGame.time}`).toLocaleString("pt-BR", {
                weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Confirmados</div>
                <div className="text-lg font-bold">{data.confirmedCount}/{data.nextGame.max_players}</div>
              </div>
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Pago</div>
                <div className="text-lg font-bold text-success">R$ {data.paidSum.toFixed(0)}</div>
              </div>
              <div className="rounded-lg bg-card/50 p-2">
                <div className="text-xs text-muted-foreground">Pendente</div>
                <div className="text-lg font-bold text-warning">R$ {data.pendingSum.toFixed(0)}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground mt-1">Nenhum jogo agendado.</div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="bg-card hover:border-primary/50 transition-colors p-4 flex flex-col items-start gap-2">
              <s.icon className="h-6 w-6 text-primary" />
              <div className="font-semibold">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <div>
            <div className="font-semibold">Grupo do WhatsApp</div>
            <div className="text-xs text-muted-foreground">
              Cole aqui o link do convite (aparece na Home do jogador).
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={whatsUrl}
            onChange={(e) => setWhatsUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
          />
          <Button onClick={onSaveWhats} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </Card>

      <Card className="bg-card p-4">
        <div className="text-xs text-muted-foreground">Jogadores ativos</div>
        <div className="text-2xl font-bold">{data?.playersCount ?? 0}</div>
      </Card>
    </div>
  );
}
