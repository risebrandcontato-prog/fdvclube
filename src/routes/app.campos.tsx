import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  MapPin,
  Star,
  ChevronRight,
  Phone,
  Clock,
  DollarSign,
  ArrowLeft,
  Navigation,
  Info,
  CalendarDays,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLocations } from "@/lib/games.functions";

export const Route = createFileRoute("/app/campos")({
  component: CamposPage,
});

function CamposPage() {
  const [selectedCampo, setSelectedCampo] = useState<any>(null);
  const listFn = useServerFn(listLocations);
  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const locations = data ?? [];

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Campos</h1>
        <span className="text-xs text-muted-foreground">
          {locations.length} campo{locations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {locations.map((l: any) => (
        <button
          key={l.id}
          onClick={() => setSelectedCampo(l)}
          className="w-full text-left group"
        >
          <Card className="overflow-hidden border-0 shadow-sm bg-card transition-transform active:scale-[0.98]">
            <div className="relative h-44">
              {l.photo_url ? (
                <img
                  src={l.photo_url}
                  alt={l.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <MapPin className="h-12 w-12 text-primary/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-lg font-bold text-white drop-shadow-md">{l.name}</h3>
                {l.address && (
                  <p className="text-xs text-white/80 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {l.address}
                  </p>
                )}
              </div>
              {l.rating != null && (
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {Number(l.rating).toFixed(1)}
                </div>
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {l.price_per_hour != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    R$ {Number(l.price_per_hour).toFixed(0)}/h
                  </span>
                )}
                {l.opening_hours && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {l.opening_hours}
                  </span>
                )}
                {l.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {l.phone}
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>
        </button>
      ))}

      {locations.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum campo cadastrado ainda.</p>
        </div>
      )}

      {/* Drawer de detalhe full-screen */}
      {selectedCampo && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <CampoDetailView campo={selectedCampo} onClose={() => setSelectedCampo(null)} />
        </div>
      )}
    </div>
  );
}

function CampoDetailView({ campo, onClose }: { campo: any; onClose: () => void }) {
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
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-background pb-8">
      <div className="relative">
        {campo.photo_url ? (
          <img
            src={campo.photo_url}
            alt={campo.name}
            className="h-64 w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="h-56 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <MapPin className="h-16 w-16 text-primary/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

        <button
          onClick={onClose}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">{campo.name}</h1>
          {campo.address && (
            <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {campo.address}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {campo.rating != null && (
          <Card className="p-4 flex items-center justify-between bg-linear-to-r from-yellow-500/10 to-transparent border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500 text-white font-bold text-lg h-12 w-12 rounded-xl flex items-center justify-center">
                {Number(campo.rating).toFixed(1)}
              </div>
              <div>
                <div className="flex items-center gap-1">{renderStars(campo.rating)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Avaliacao dos jogadores</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {campo.price_per_hour != null && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Preco/hora</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                R$ {Number(campo.price_per_hour).toFixed(2)}
              </p>
            </Card>
          )}

          {campo.opening_hours && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Funcionamento</span>
              </div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {campo.opening_hours}
              </p>
            </Card>
          )}

          {campo.phone && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Telefone</span>
              </div>
              <a
                href={`tel:${campo.phone.replace(/\D/g, "")}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {campo.phone}
              </a>
            </Card>
          )}

          <Card className="p-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Reservas</span>
            </div>
            <p className="text-sm font-semibold text-foreground">Via admin do time</p>
          </Card>
        </div>

        {campo.notes && (
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Observacoes</p>
                <p className="text-sm text-foreground leading-relaxed">{campo.notes}</p>
              </div>
            </div>
          </Card>
        )}

        {campo.maps_url && (
          <a
            href={campo.maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-glow"
          >
            <Navigation className="h-5 w-5" />
            Abrir no Google Maps
          </a>
        )}
      </div>
    </div>
  );
}