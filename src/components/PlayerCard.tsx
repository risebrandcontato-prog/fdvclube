import { Link } from "@tanstack/react-router";
import { CircleCheck, AlertCircle, CircleX } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";

type PlayerStatus = "confirmed" | "pending" | "cancelled";

const statusMap: Record<PlayerStatus, { label: string; cls: string; icon: typeof CircleCheck }> = {
  confirmed: {
    label: "Confirmado",
    cls: "text-emerald-400 bg-emerald-500/10",
    icon: CircleCheck,
  },
  pending: {
    label: "Pendente",
    cls: "text-amber-400 bg-amber-500/10",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelado",
    cls: "text-red-400 bg-red-500/10",
    icon: CircleX,
  },
};

export function PlayerCard({
  playerId,
  name,
  avatarUrl,
  position,
  status,
  className,
}: {
  playerId: string;
  name: string;
  avatarUrl?: string | null;
  position?: string | null;
  status?: PlayerStatus;
  className?: string;
}) {
  const statusCfg = status ? statusMap[status] : null;

  return (
    <Link
      to="/app/jogadores/$id"
      params={{ id: playerId }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card p-2.5 transition-all hover:border-primary/40 hover:bg-accent/20",
        className,
      )}
    >
      <PlayerAvatar name={name} src={avatarUrl} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {position ? <span className="truncate text-[11px] text-muted-foreground">{position}</span> : null}
          {statusCfg ? (
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium", statusCfg.cls)}>
              <statusCfg.icon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
