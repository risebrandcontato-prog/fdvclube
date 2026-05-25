import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FdvLogo } from "@/components/FdvLogo";
import { useSession } from "@/hooks/use-session";
import { validateInviteCode } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  component: EntryPage,
});

function EntryPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { player, loading, setSession } = useSession();
  const validate = useServerFn(validateInviteCode);

  useEffect(() => {
    if (loading) return;
    if (player) {
      if (player.is_blocked) navigate({ to: "/suspended" });
      else navigate({ to: "/app" });
    }
  }, [player, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      const res = await validate({ data: { code } });
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      if (res.kind === "existing") {
        await setSession(res.token);
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/app" });
      } else {
        navigate({ to: "/onboarding", search: { invite: res.inviteId } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-gradient-field flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_20%,_var(--primary)_0%,_transparent_60%)] pointer-events-none" />
      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-6">
        <FdvLogo className="h-24 w-24 drop-shadow-glow" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">FDV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Futebol de Amigos · Acesso por convite</p>
        </div>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-3 mt-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="FDV-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            className="text-center text-lg tracking-widest font-semibold h-14 bg-card border-border"
            maxLength={32}
          />
          <Button
            type="submit"
            disabled={submitting || !code.trim()}
            className="h-14 text-base font-semibold bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          >
            {submitting ? "Validando..." : "Entrar no time"}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-2">
          Sem código? Peça ao admin do time.
        </p>
      </div>
    </main>
  );
}
