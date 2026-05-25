import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FdvLogo } from "@/components/FdvLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useSession } from "@/hooks/use-session";
import { createProfile } from "@/lib/auth.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ invite: z.string().uuid() }),
  component: OnboardingPage,
});

const positions = [
  { value: "goleiro", label: "Goleiro" },
  { value: "defensor", label: "Defensor" },
  { value: "meio", label: "Meio-campo" },
  { value: "atacante", label: "Atacante" },
] as const;

function OnboardingPage() {
  const { invite } = Route.useSearch();
  const navigate = useNavigate();
  const { setSession } = useSession();
  const createFn = useServerFn(createProfile);

  const [name, setName] = useState("");
  const [position, setPosition] = useState<typeof positions[number]["value"]>("meio");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${invite}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await createFn({ data: { inviteId: invite, name, position, avatar_url: avatarUrl } });
      await setSession(res.token);
      toast.success("Perfil criado!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-10 safe-top safe-bottom">
      <div className="mx-auto max-w-sm flex flex-col items-center text-center">
        <FdvLogo className="h-16 w-16" />
        <h1 className="mt-4 text-2xl font-bold">Criar perfil</h1>
        <p className="text-sm text-muted-foreground">Vamos te apresentar ao time.</p>

        <form onSubmit={onSubmit} className="mt-8 w-full flex flex-col gap-5 text-left">
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              <PlayerAvatar name={name || "?"} src={avatarUrl} className="h-24 w-24 ring-2 ring-primary/40" />
              <div className="mt-2 text-xs text-primary font-medium">
                {uploading ? "Enviando..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </div>
            </label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>

          <div className="grid gap-2">
            <Label>Posição</Label>
            <div className="grid grid-cols-2 gap-2">
              {positions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    position === p.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={saving || !name.trim()} className="h-12 bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? "Salvando..." : "Salvar e entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
