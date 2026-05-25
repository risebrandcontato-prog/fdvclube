import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Plus, Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminListCodes, adminGenerateCode, adminRevokeCode } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/codigos")({
  component: CodigosPage,
});

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "Disponível", cls: "text-success" },
  used: { label: "Usado", cls: "text-muted-foreground" },
  revoked: { label: "Revogado", cls: "text-destructive" },
  blocked: { label: "Bloqueado", cls: "text-warning" },
};

function CodigosPage() {
  const list = useServerFn(adminListCodes);
  const gen = useServerFn(adminGenerateCode);
  const revoke = useServerFn(adminRevokeCode);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-codes"], queryFn: () => list() });

  async function generate() {
    try {
      const code = await gen();
      toast.success(`Código gerado: ${code.code}`);
      qc.invalidateQueries({ queryKey: ["admin-codes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); toast.success("Copiado!"); } catch { /* */ }
  }

  async function doRevoke(id: string) {
    try {
      await revoke({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-codes"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Códigos</h1>
        <Button onClick={generate} className="bg-gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4" /> Gerar
        </Button>
      </div>

      <div className="space-y-2">
        {(data ?? []).map((c) => {
          const st = statusMap[c.status] ?? statusMap.pending;
          return (
            <Card key={c.id} className="bg-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono font-bold tracking-widest">{c.code}</div>
                <div className="text-xs mt-0.5">
                  <span className={st.cls}>{st.label}</span>
                  {c.players ? <span className="text-muted-foreground"> · {c.players.name}</span> : null}
                </div>
              </div>
              <div className="flex gap-1">
                {c.status === "pending" ? (
                  <Button size="icon" variant="ghost" onClick={() => copy(c.code)}><Copy className="h-4 w-4" /></Button>
                ) : null}
                {c.status !== "revoked" ? (
                  <Button size="icon" variant="ghost" onClick={() => doRevoke(c.id)}>
                    <Ban className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
