import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useCallback } from "react";
import {
  MapPin,
  Phone,
  Clock,
  DollarSign,
  Star,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  adminListLocations,
  adminCreateLocation,
  adminUpdateLocation,
  adminDeleteLocation,
  uploadFieldPhoto,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/campos")({
  component: CamposAdminPage,
});

function CamposAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListLocations);
  const createFn = useServerFn(adminCreateLocation);
  const updateFn = useServerFn(adminUpdateLocation);
  const deleteFn = useServerFn(adminDeleteLocation);
  const uploadFn = useServerFn(uploadFieldPhoto);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    address: "",
    maps_url: "",
    photo_url: "",
    phone: "",
    price_per_hour: "",
    opening_hours: "",
    rating: "",
    notes: "",
  });

  const resetForm = useCallback(() => {
    setForm({
      name: "",
      address: "",
      maps_url: "",
      photo_url: "",
      phone: "",
      price_per_hour: "",
      opening_hours: "",
      rating: "",
      notes: "",
    });
    setPreviewUrl("");
    setEditingId(null);
  }, []);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      resetForm();
    }
  };

  const openEdit = (loc: any) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name ?? "",
      address: loc.address ?? "",
      maps_url: loc.maps_url ?? "",
      photo_url: loc.photo_url ?? "",
      phone: loc.phone ?? "",
      price_per_hour: loc.price_per_hour ? String(loc.price_per_hour) : "",
      opening_hours: loc.opening_hours ?? "",
      rating: loc.rating ? String(loc.rating) : "",
      notes: loc.notes ?? "",
    });
    setPreviewUrl(loc.photo_url ?? "");
    setOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Apenas imagens são permitidas.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        setIsSubmitting(true);
        const res = await uploadFn({
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type,
        });
        setForm((prev) => ({ ...prev, photo_url: res.url }));
        setPreviewUrl(res.url);
      } catch (err: any) {
        alert(err.message ?? "Erro no upload");
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        maps_url: form.maps_url.trim() || undefined,
        photo_url: form.photo_url.trim() || undefined,
        phone: form.phone.trim() || undefined,
        price_per_hour: form.price_per_hour ? Number(form.price_per_hour) : undefined,
        opening_hours: form.opening_hours.trim() || undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingId) {
        await updateFn({ id: editingId, ...payload });
      } else {
        await createFn(payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      alert(err.message ?? "Erro ao salvar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFn({ id });
      await queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
    } catch (err: any) {
      alert(err.message ?? "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const renderStars = (rating: number | null | undefined) => {
    const r = Math.round((rating ?? 0) * 2) / 2;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i <= r
                ? "fill-yellow-400 text-yellow-400"
                : i - 0.5 === r
                ? "fill-yellow-400/50 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">{rating ?? "0"}/5</span>
      </div>
    );
  };

  return (
    <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campos</h1>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo campo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : (locations ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {(locations ?? []).map((loc: any) => (
            <Card key={loc.id} className="overflow-hidden">
              {loc.photo_url ? (
                <img
                  src={loc.photo_url}
                  alt={loc.name}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-lg">{loc.name}</div>
                    {loc.address && (
                      <div className="text-sm text-muted-foreground flex items-start gap-1 mt-0.5">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{loc.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(loc.id)}
                      disabled={deletingId === loc.id}
                    >
                      {deletingId === loc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {loc.phone && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{loc.phone}</span>
                    </div>
                  )}
                  {loc.price_per_hour !== null && loc.price_per_hour !== undefined && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>R$ {Number(loc.price_per_hour).toFixed(2)}/h</span>
                    </div>
                  )}
                  {loc.opening_hours && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{loc.opening_hours}</span>
                    </div>
                  )}
                  {loc.rating !== null && loc.rating !== undefined && (
                    <div className="flex items-center gap-1">
                      {renderStars(loc.rating)}
                    </div>
                  )}
                </div>

                {loc.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                    {loc.notes}
                  </p>
                )}

                {loc.maps_url && (
                  <a
                    href={loc.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary"
                  >
                    Abrir no Google Maps <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar campo" : "Novo campo"}</DialogTitle>
            <DialogDescription>
              Preencha as informações do campo. Campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Arena FDV"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maps_url">Link Google Maps</Label>
              <Input
                id="maps_url"
                value={form.maps_url}
                onChange={(e) => setForm((p) => ({ ...p, maps_url: e.target.value }))}
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Foto do campo</Label>
              <div className="flex items-center gap-3">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl("");
                        setForm((p) => ({ ...p, photo_url: "" }));
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {previewUrl ? "Trocar foto" : "Enviar foto"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Máx. 5MB (JPG, PNG, WEBP)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_per_hour">Preço/hora (R$)</Label>
                <Input
                  id="price_per_hour"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_per_hour}
                  onChange={(e) => setForm((p) => ({ ...p, price_per_hour: e.target.value }))}
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="opening_hours">Horário de funcionamento</Label>
                <Input
                  id="opening_hours"
                  value={form.opening_hours}
                  onChange={(e) => setForm((p) => ({ ...p, opening_hours: e.target.value }))}
                  placeholder="Seg-Sex 08h-22h"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Avaliação (0-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.5"
                  min="0"
                  max="5"
                  value={form.rating}
                  onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))}
                  placeholder="4.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Informações extras sobre o campo..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                {editingId ? "Salvar alterações" : "Criar campo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}