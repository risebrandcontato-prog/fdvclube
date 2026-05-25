import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/suspended")({
  component: SuspendedPage,
});

function SuspendedPage() {
  const { logout } = useSession();
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-6 text-center">
      <div className="max-w-sm flex flex-col items-center">
        <div className="h-20 w-20 rounded-full bg-destructive/15 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Acesso suspenso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu acesso foi bloqueado pelo admin. Entre em contato para regularizar.
        </p>
        <Button variant="outline" onClick={() => logout().then(() => (window.location.href = "/"))} className="mt-6">
          Sair
        </Button>
      </div>
    </main>
  );
}
