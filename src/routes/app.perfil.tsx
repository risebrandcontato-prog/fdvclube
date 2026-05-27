import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Shield, ArrowLeft, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionBadge } from "@/components/Badges";
import { useSession } from "@/hooks/use-session";
import { myAttendanceHistory } from "@/lib/games.functions";
import { getMyProfile, updatePlayerProfile, uploadAvatar } from "@/lib/auth.functions";
import { prepareImageForUpload } from "@/lib/image-upload";

export const Route = createFileRoute("/app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { player, logout } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(myAttendanceHistory);
  const getProfileFn = useServerFn(getMyProfile);
  const updateProfileFn = useServerFn(updatePlayerProfile);
  const uploadAvatarFn = useServerFn(uploadAvatar);
  const { data } = useQuery({ queryKey: ["my-attendance"], queryFn: () => fn() });
  const attendance = data?.data ?? [];
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile-full"],
    queryFn: () => getProfileFn(),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: profileData?.name ?? "",
    nickname: profileData?.nickname ?? "",
    phone: profileData?.phone ?? "",
    birth_date: profileData?.birth_date ?? "",
    preferred_position: profileData?.preferred_position ?? "",
    secondary_position: profileData?.secondary_position ?? "",
    strong_foot: profileData?.strong_foot ?? "right",
    avatar_url: profileData?.avatar_url ?? "",
  });

  useEffect(() => {
    if (!profileData) return;
    setForm({
      name: profileData.name ?? "",
      nickname: profileData.nickname ?? "",
      phone: profileData.phone ?? "",
      birth_date: profileData.birth_date ?? "",
      preferred_position: profileData.preferred_position ?? "",
      secondary_position: profileData.secondary_position ?? "",
      strong_foot: profileData.strong_foot ?? "right",
      avatar_url: profileData.avatar_url ?? "",
    });
  }, [profileData]);

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem válida.");
      return;
    }

    try {
      setUploading(true);
      const base64 = await prepareImageForUpload(file);
      const result = await uploadAvatarFn({
        data: { fileBase64: base64, fileName: file.name, contentType: file.type },
      });
      setForm((prev) => ({ ...prev, avatar_url: result.url }));
      toast.success("Foto atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }

    try {
      setSaving(true);
      const result = await updateProfileFn({
        data: {
          name: form.name.trim(),
          nickname: form.nickname.trim() || null,
          phone: form.phone.trim() || null,
          birth_date: form.birth_date || null,
          preferred_position: form.preferred_position.trim() || null,
          secondary_position: form.secondary_position.trim() || null,
          strong_foot: (form.strong_foot as "left" | "right" | "both") ?? "right",
          avatar_url: form.avatar_url || null,
        },
      });
      if (!result.success) {
        toast.error(result.error ?? "Erro ao salvar perfil.");
        return;
      }
      toast.success("Perfil atualizado");
      await qc.invalidateQueries({ queryKey: ["my-profile-full"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })} className="px-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>
      <h1 className="text-2xl font-bold">Perfil</h1>

      <Card className="bg-card p-5 flex items-center gap-4">
        <div className="relative">
          <PlayerAvatar name={form.name || player?.name} src={form.avatar_url || player?.avatar_url} className="h-16 w-16 ring-2 ring-primary/40" />
          <label className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-primary-foreground cursor-pointer">
            <Camera className="h-3.5 w-3.5" />
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-lg flex items-center gap-2">
            {form.name || player?.name}
            {player?.is_admin ? <Shield className="h-4 w-4 text-primary" /> : null}
          </div>
          <div className="mt-1"><PositionBadge position={form.preferred_position || player?.position ?? ""} /></div>
          {uploading ? <p className="text-xs text-muted-foreground mt-1">Enviando foto...</p> : null}
        </div>
      </Card>

      <Card className="bg-card p-4">
        <form onSubmit={onSaveProfile} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Apelido</Label>
              <Input value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Pé dominante</Label>
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={form.strong_foot}
                onChange={(e) => setForm((p) => ({ ...p, strong_foot: e.target.value }))}
              >
                <option value="right">Direito</option>
                <option value="left">Esquerdo</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Posição preferida</Label>
              <Input
                value={form.preferred_position}
                onChange={(e) => setForm((p) => ({ ...p, preferred_position: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Posição secundária</Label>
              <Input
                value={form.secondary_position}
                onChange={(e) => setForm((p) => ({ ...p, secondary_position: e.target.value }))}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving || profileLoading}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </form>
      </Card>

      <Card className="bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Histórico de presenças ({attendance.length})
        </div>
        <div className="space-y-2">
          {attendance.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{c.games?.title}</span>
              <span className="text-muted-foreground">
                {c.games?.date ? new Date(c.games.date).toLocaleDateString("pt-BR") : ""}
              </span>
            </div>
          ))}
          {attendance.length === 0 ? <p className="text-sm text-muted-foreground">Sem histórico.</p> : null}
          {data?.error ? <p className="text-sm text-destructive">{data.error}</p> : null}
        </div>
      </Card>

      <Button
        variant="outline"
        className="w-full h-12"
        onClick={async () => { await logout(); navigate({ to: "/" }); }}
      >
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}
