import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listLocations } from "@/lib/games.functions";
import { adminCreateLocation, adminDeleteLocation } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/campos")({
  component: AdminCampos,
});

function AdminCampos() {
  const list = useServerFn(listLocations);
  const create = useServerFn(adminCreateLocation);
  const del = useServerFn(adminDeleteLocation);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["locations"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", maps_url: "", photo_url: "" });
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("fields").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("fields").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: {
        name: form.name,
        address: form.address || undefined,
        maps_url: form.maps_url || undefined,
        photo_url: form.photo_url || undefined,
      } });
      setOpen(false);
      setForm({ name: "", address: "", maps_url: "", photo_url: "" });
      qc.invalidateQueries({ queryKey: ["locations"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function remove(id: string) {
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["locations"] });
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-sm">
            <DialogHeader><DialogTitle>Novo campo</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid gap-1.5"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Link Google Maps</Label><Input type="url" value={form.maps_url} onChange={(e) => setForm({ ...form, maps_url: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Foto</Label><Input type="file" accept="image/*" onChange={onFile} />{uploading ? <span className="text-xs">Enviando...</span> : null}</div>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(data ?? []).map((l) => (
          <Card key={l.id} className="bg-card p-3 flex items-center gap-3">
            {l.photo_url ? <img src={l.photo_url} alt={l.name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-gradient-field" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{l.name}</div>
              <div className="text-xs text-muted-foreground truncate">{l.address}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
