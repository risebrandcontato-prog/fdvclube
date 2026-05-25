import { CalendarDays, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ConfirmBadge } from "./Badges";

function formatDate(date: string, time: string) {
  // date "YYYY-MM-DD", time "HH:MM[:SS]"
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  const weekday = dt.toLocaleDateString("pt-BR", { weekday: "short" });
  const dayMonth = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const hour = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { weekday, dayMonth, hour };
}

type Props = {
  id: string;
  title: string;
  date: string;
  time: string;
  locationName?: string | null;
  confirmedCount: number;
  maxPlayers: number;
  myStatus: "confirmed" | "cancelled" | "none";
  linkTo: string;
};

export function GameCard(p: Props) {
  const { weekday, dayMonth, hour } = formatDate(p.date, p.time);
  return (
    <Link to={p.linkTo} className="block">
      <Card className="bg-card border-border p-4 hover:border-primary/50 transition-colors shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center justify-center min-w-[64px] rounded-xl bg-gradient-field p-2 ring-1 ring-border">
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{weekday.replace(".", "")}</div>
            <div className="text-lg font-bold text-foreground leading-tight">{dayMonth}</div>
            <div className="text-[11px] text-muted-foreground">{hour}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">{p.title}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{p.locationName ?? "Sem campo"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <ConfirmBadge status={p.myStatus} />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span><span className="text-foreground font-semibold">{p.confirmedCount}</span>/{p.maxPlayers}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
