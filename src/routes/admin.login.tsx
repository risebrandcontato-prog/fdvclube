import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { validateAdminPassword } from "@/lib/admin.auth";
import { setStoredToken } from "@/lib/session-client";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await validateAdminPassword({ data: { password } });

      if (result.ok && result.token) {
        setStoredToken(result.token); // Reusa o mesmo localStorage
        toast.success("Bem-vindo, Admin!");
        navigate({ to: "/admin/jogos" });
      } else {
        toast.error(result.reason || "Senha incorreta");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center pb-2">
          <Shield className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-white">Painel Admin</h1>
          <p className="text-sm text-zinc-400">FDV Clube</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha do admin"
              className="bg-zinc-950 border-zinc-700 text-white text-center"
              disabled={isLoading}
            />
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}