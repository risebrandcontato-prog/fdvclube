import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function PlayerAvatar({
  name,
  src,
  className,
}: { name?: string | null; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("ring-1 ring-border", className)}>
      {src ? <AvatarImage src={src} alt={name ?? "Jogador"} /> : null}
      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
