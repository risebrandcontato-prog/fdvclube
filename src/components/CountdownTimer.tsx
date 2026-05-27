import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  status: "upcoming" | "live" | "finished";
}

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

export function CountdownTimer({ targetDate, className = "" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    const target = new Date(targetDate);
    const now = new Date();

    // Se o jogo já passou há mais de 3 horas, considera finalizado
    const diffFinished = now.getTime() - target.getTime();
    if (diffFinished > 3 * 60 * 60 * 1000) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, status: "finished" });
      return;
    }

    // Se o jogo já começou (até 3h depois), está "ao vivo"
    if (diffFinished >= 0 && diffFinished <= 3 * 60 * 60 * 1000) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, status: "live" });
      return;
    }

    const interval = setInterval(() => {
      const currentNow = new Date();
      const diff = target.getTime() - currentNow.getTime();

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, status: "live" });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, status: "upcoming" });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  const { days, hours, minutes, seconds, status } = timeLeft;

  if (status === "finished") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700 text-slate-300 text-sm font-medium ${className}`}>
        <span>🏁</span> Jogo finalizado
      </div>
    );
  }

  if (status === "live") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-600 text-white text-sm font-medium animate-pulse ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        ⚽ Jogo em andamento
      </div>
    );
  }

  const isUrgent = days === 0 && hours < 1;
  const isWarning = days === 0 && hours < 24;
  const colorClass = isUrgent
    ? "bg-red-600 text-white"
    : isWarning
    ? "bg-amber-500 text-white"
    : "bg-emerald-600 text-white";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colorClass} ${className}`}>
      <span>⏰</span>
      <span className="tabular-nums">
        {days > 0 && `${days}d `}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
      <span className="text-xs opacity-80">
        {isUrgent ? " - Vai começar!" : isWarning ? " - Hoje!" : ""}
      </span>
    </div>
  );
}