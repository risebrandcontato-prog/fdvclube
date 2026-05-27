import { CheckCircle, Clock, AlertTriangle, Gift } from "lucide-react";

interface PaymentBadgeProps {
  status: "paid" | "pending" | "late" | "exempt" | null;
  amount?: number;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const config = {
  paid: {
    label: "Pago",
    icon: CheckCircle,
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-500",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 border-amber-200",
    iconColor: "text-amber-500",
  },
  late: {
    label: "Atrasado",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 border-red-200",
    iconColor: "text-red-500",
  },
  exempt: {
    label: "Isento",
    icon: Gift,
    className: "bg-slate-100 text-slate-600 border-slate-200",
    iconColor: "text-slate-400",
  },
};

export function PaymentBadge({ status, amount, showIcon = true, size = "sm" }: PaymentBadgeProps) {
  if (!status || !config[status]) return null;

  const { label, icon: Icon, className, iconColor } = config[status];
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${className} ${sizeClasses}`}>
      {showIcon && <Icon className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} ${iconColor}`} />}
      <span>{label}</span>
      {amount && status !== "exempt" ? <span className="opacity-70">R$ {amount}</span> : null}
    </span>
  );
}