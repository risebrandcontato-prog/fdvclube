import { cn } from "@/lib/utils";

type PaymentStatus = "paid" | "pending" | "late" | "exempt";
type ConfirmStatus = "confirmed" | "cancelled" | "none";

const paymentMap: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  pending: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  late: { label: "Em atraso", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  exempt: { label: "Isento", cls: "bg-muted text-muted-foreground border-border" },
};

const confirmMap: Record<ConfirmStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "bg-success/15 text-success border-success/30" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  none: { label: "Sem resposta", cls: "bg-muted text-muted-foreground border-border" },
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const m = paymentMap[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", m.cls)}>
      {m.label}
    </span>
  );
}

export function ConfirmBadge({ status }: { status: ConfirmStatus }) {
  const m = confirmMap[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", m.cls)}>
      {m.label}
    </span>
  );
}

const positionLabel: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  meio: "Meio-campo",
  atacante: "Atacante",
};

export function PositionBadge({ position }: { position: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {positionLabel[position] ?? position}
    </span>
  );
}
