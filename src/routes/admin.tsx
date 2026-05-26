import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, LogOut } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { checkAdminToken } from "@/lib/admin.auth";
import { clearStoredToken } from "@/lib/session-client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const verify = async () => {
      // Se for /admin/login, não verifica (deixa acessar)
      if (location.pathname === "/admin/login") {
        setIsChecking(false);
        return;
      }

      const result = await checkAdminToken();

      if (!result.valid) {
        clearStoredToken();
        navigate({ to: "/admin/login" });
        return;
      }

      setIsAdmin(true);
      setIsChecking(false);
    };

    verify();
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    clearStoredToken();
    navigate({ to: "/admin/login" });
  };

  // Se estiver na tela de login, renderiza Outlet direto sem layout
  if (location.pathname === "/admin/login") {
    return <Outlet />;
  }

  if (isChecking) {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Verificando acesso...
      </div>
    );
  }

  if (!isAdmin) {
    return null; // navigate já redirecionou
  }

  // Só mostra "Voltar" se NÃO estiver na dashboard (/admin)
  const showBack = location.pathname !== "/admin" && location.pathname !== "/admin/";

  return (
    <div className="min-h-dvh bg-zinc-950 pb-20">
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="mx-auto max-w-lg flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">Painel Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {showBack ? (
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-300 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
          </button>
        ) : null}
        <Outlet />
      </div>

      <BottomNav />
    </div>
  );
}