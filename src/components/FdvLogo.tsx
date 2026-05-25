import logo from "@/assets/fdv-icon.png";

export function FdvLogo({ className }: { className?: string }) {
  return <img src={logo} alt="FDV" className={className} loading="eager" width={64} height={64} />;
}
