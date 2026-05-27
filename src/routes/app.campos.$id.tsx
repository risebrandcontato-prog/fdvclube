import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Phone, Clock, DollarSign, Star, Navigation, Info, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLocations } from "@/lib/games.functions";

export const Route = createFileRoute("/app/campos/$id")({
  component: CampoDetailPage,
});

function CampoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const listFn = useServerFn(listLocations);

  const { data: locationsRes, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const locations = locationsRes?.data ?? [];
  const campo = locations.find((l: any) => l.id === id);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="h-64 bg-muted animate-pulse" />
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!campo) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
        <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">Campo não encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate({ to: "/app/campos" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const renderStars = (rating: number | null | undefined) => {
    const r = Math.round((rating ?? 0) * 2) / 2;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i <= r ? "fill-yellow-400 text-yellow-400" : i - 0.5 === r ? "fill-yellow-400/50 text-yellow-400" : "text-gray-300"
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
          <img src={campo.photo_url} alt={campo.name} className="h-64 w-full object-cover" loading="eager" />
        ) : (
          <div className="h-56 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <MapPin className="h-16 w-16 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        <button onClick={() => navigate({ to: "/app/campos" })} className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">{campo.name}</h1>
          {campo.address && <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5"><MapPin className="h-3.5 w-3.5" />{campo.address}</p>}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {campo.rating != null && (
          <Card className="p-4 flex items-center justify-between bg-linear-to-r from-yellow-500/10 to-transparent border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500 text-white font-bold text-lg h-12 w-12 rounded-xl flex items-center justify-center">{Number(campo.rating).toFixed(1)}</div>
              <div>
                <div className="flex items-center gap-1">{renderStars(campo.rating)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Avaliação dos jogadores</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {campo.price_per_hour != null && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground"><DollarSign className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Preço/hora</span></div>
              <p className="text-lg font-bold text-foreground">R$ {Number(campo.price_per_hour).toFixed(2)}</p>
            </Card>
          )}
          {campo.opening_hours && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Funcionamento</span></div>
              <p className="text-sm font-semibold text-foreground leading-tight">{campo.opening_hours}</p>
            </Card>
          )}
          {campo.phone && (
            <Card className="p-3.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Telefone</span></div>
              <a href={`tel:${campo.phone.replace(/\D/g, "")}`} className="text-sm font-semibold text-primary hover:underline">{campo.phone}</a>
            </Card>
          )}
          <Card className="p-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Reservas</span></div>
            <p className="text-sm font-semibold text-foreground">Via admin do time</p>
          </Card>
        </div>

        {campo.notes && (
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                <p className="text-sm text-foreground leading-relaxed">{campo.notes}</p>
              </div>
            </div>
          </Card>
        )}

        {campo.maps_url && (
          <a href={campo.maps_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-glow">
            <Navigation className="h-5 w-5" />Abrir no Google Maps
          </a>
        )}
      </div>
    </div>
  );
}