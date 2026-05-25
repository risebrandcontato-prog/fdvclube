import { Link, useLocation } from "@tanstack/react-router";
import { Home, CalendarDays, MapPin, Wallet, User, Shield } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  { to: "/app/jogos", label: "Jogos", icon: CalendarDays, match: (p: string) => p.startsWith("/app/jogos") },
  { to: "/app/campos", label: "Campos", icon: MapPin, match: (p: string) => p.startsWith("/app/campos") },
  { to: "/app/pagamentos", label: "Pagamentos", icon: Wallet, match: (p: string) => p.startsWith("/app/pagamentos") },
  { to: "/app/perfil", label: "Perfil", icon: User, match: (p: string) => p.startsWith("/app/perfil") },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { player } = useSession();

  const all = [...items];
  if (player?.is_admin) {
    all.push({ to: "/admin", label: "Admin", icon: Shield, match: (p: string) => p.startsWith("/admin") });
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur safe-bottom">
      <div className="mx-auto max-w-lg grid" style={{ gridTemplateColumns: `repeat(${all.length}, minmax(0, 1fr))` }}>
        {all.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_var(--primary)]")} />
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
