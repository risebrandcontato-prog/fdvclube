import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FdvLogo } from "@/components/FdvLogo";
import { useSession } from "@/hooks/use-session";
import { validateInviteCode } from "@/lib/auth.functions";
import { Download, Share, PlusSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  component: EntryPage,
});

// ── Types para o evento beforeinstallprompt ──
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function EntryPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { player, loading, setSession } = useSession();
  const validate = useServerFn(validateInviteCode);

  // ── PWA Install State ──
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (player) {
      if (player.is_blocked) navigate({ to: "/suspended" });
      else navigate({ to: "/app" });
    }
  }, [player, loading, navigate]);

  // ── Detecta se é iOS ──
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
  }, []);

  // ── Captura o evento beforeinstallprompt (Android/Chrome) ──
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detecta se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Handler de instalação ──
  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      toast.success("App instalado com sucesso!");
      setIsInstalled(true);
      setInstallPrompt(null);
    } else {
      toast.info("Você pode instalar depois pelo menu do navegador.");
    }
  }, [installPrompt]);

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

  // ── Não mostra nada se já estiver instalado ──
  if (isInstalled) return null;

  return (
    <main className="relative min-h-dvh bg-gradient-field flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_20%,_var(--primary)_0%,_transparent_60%)] pointer-events-none" />
      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-6">
        <FdvLogo className="h-24 w-24 drop-shadow-glow" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">FDV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Futebol de Amigos · Acesso por convite</p>
        </div>

        {/* ── Botão de Instalar PWA ── */}
        {installPrompt && !isIOS && (
          <div className="w-full">
            <Button
              type="button"
              onClick={handleInstall}
              variant="outline"
              className="w-full h-12 text-base font-semibold border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
            >
              <Download className="h-5 w-5 mr-2" />
              Instalar app no celular
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Instale para acesso rápido, notificações e funcionar offline
            </p>
          </div>
        )}

        {/* ── Instruções para iOS ── */}
        {isIOS && (
          <div className="w-full bg-card/80 rounded-xl p-3 border border-border/50">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Share className="h-4 w-4 text-primary" />
              Para instalar no iPhone:
            </p>
            <ol className="text-xs text-muted-foreground mt-1.5 space-y-1 text-left list-decimal list-inside">
              <li>Toque no botão <strong>Compartilhar</strong> no Safari</li>
              <li>Role e toque em <strong>"Adicionar à Tela de Início"</strong></li>
              <li>Toque em <strong>Adicionar</strong></li>
            </ol>
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-3 mt-2">
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