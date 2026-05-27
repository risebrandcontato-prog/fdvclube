import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FdvLogo } from "@/components/FdvLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useSession } from "@/hooks/use-session";
import { createProfile, uploadAvatar } from "@/lib/auth.functions";
import { prepareImageForUpload } from "@/lib/image-upload";
import { cn } from "@/lib/utils";
import { Camera, Footprints, Hash } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ invite: z.string().uuid() }),
  component: OnboardingPage,
});

const positions = [
  { value: "goleiro", label: "Goleiro", icon: "🧤" },
  { value: "zagueiro", label: "Zagueiro", icon: "🛡️" },
  { value: "lateral_direito", label: "Lateral Direito", icon: "→" },
  { value: "lateral_esquerdo", label: "Lateral Esquerdo", icon: "←" },
  { value: "volante", label: "Volante", icon: "⚓" },
  { value: "meio_campo", label: "Meio-Campo", icon: "🎮" },
  { value: "meia_atacante", label: "Meia-Atacante", icon: "⚡" },
  { value: "ponta_direita", label: "Ponta Direita", icon: "→⚡" },
  { value: "ponta_esquerda", label: "Ponta Esquerda", icon: "⚡←" },
  { value: "centroavante", label: "Centroavante", icon: "🎯" },
  { value: "segundo_atacante", label: "Segundo Atacante", icon: "🎯⚡" },
] as const;

type PositionValue = (typeof positions)[number]["value"];

const preferredFootOptions = [
  { value: "right" as const, label: "Direita", icon: "🦶" },
  { value: "left" as const, label: "Esquerda", icon: "🦶" },
  { value: "both" as const, label: "Ambas", icon: "🦶🦶" },
] as const;

type FootValue = (typeof preferredFootOptions)[number]["value"];

function OnboardingPage() {
  const { invite } = Route.useSearch();
  const navigate = useNavigate();
  const { setSession } = useSession();
  const createFn = useServerFn(createProfile);
  const uploadFn = useServerFn(uploadAvatar);

  const [name, setName] = useState("");
  const [position, setPosition] = useState<PositionValue>("meio_campo");
  const [jerseyNumber, setJerseyNumber] = useState<string>("");
  const [preferredFoot, setPreferredFoot] = useState<FootValue>("right");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas.");
      return;
    }

    setUploading(true);
    try {
      const base64 = await prepareImageForUpload(file);

      const result = await uploadFn({
        data: {
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type,
        },
      });

      setAvatarUrl(result.url);
      toast.success("Foto enviada com sucesso!");
    } catch (err) {
      console.error("[onFile] Erro:", err);
      toast.error(err instanceof Error ? err.message : "Falha ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Digite seu nome");
      return;
    }
    setSaving(true);
    try {
      const res = await createFn({
        data: {
          inviteId: invite,
          name,
          position,
          jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
          preferred_foot: preferredFoot,
          avatar_url: avatarUrl,
        },
      });
      await setSession(res.token);
      toast.success("Perfil criado! Bem-vindo ao time!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-8 safe-top safe-bottom">
      <div className="mx-auto max-w-sm flex flex-col items-center text-center">
        <FdvLogo className="h-16 w-16" />
        <h1 className="mt-4 text-2xl font-bold">Criar perfil</h1>
        <p className="text-sm text-muted-foreground">Complete seu perfil para entrar no time.</p>

        <form onSubmit={onSubmit} className="mt-8 w-full flex flex-col gap-6 text-left">
          {/* FOTO */}
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer relative">
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              <div className="relative">
                <PlayerAvatar
                  name={name || "?"}
                  src={avatarUrl}
                  className="h-28 w-28 ring-2 ring-primary/40"
                />
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Camera className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xs text-primary font-medium">
                {uploading ? "Enviando..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </div>
            </label>
          </div>

          {/* NOME */}
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm font-medium">Seu nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Ex: Leonardo"
              required
              className="h-11"
            />
          </div>

          {/* POSIÇÃO */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Posição</Label>
            <div className="grid grid-cols-2 gap-2">
              {positions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    position === p.value
                      ? "border-primary bg-primary/15 text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  <span className="mr-1">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* NÚMERO DA CAMISA */}
          <div className="grid gap-2">
            <Label htmlFor="jersey" className="text-sm font-medium inline-flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-primary" />
              Número da camisa
            </Label>
            <Input
              id="jersey"
              type="number"
              min={1}
              max={99}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder="Ex: 10"
              className="h-11"
            />
            <p className="text-[10px] text-muted-foreground">Escolha seu número favorito (1-99)</p>
          </div>

          {/* PERNA PREFERIDA */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium inline-flex items-center gap-1.5">
              <Footprints className="h-4 w-4 text-primary" />
              Chuta com qual perna?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {preferredFootOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setPreferredFoot(f.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all flex flex-col items-center gap-1",
                    preferredFoot === f.value
                      ? "border-primary bg-primary/15 text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-xs">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* BOTÃO */}
          <Button
            type="submit"
            disabled={saving || !name.trim()}
            className="h-12 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {saving ? "Salvando..." : "Salvar e entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}