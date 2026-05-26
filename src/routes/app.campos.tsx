import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MapPin, Phone, Clock, DollarSign, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listLocations } from "@/lib/games.functions";

export const Route = createFileRoute("/app/campos")({
  component: CamposPage,
});

function CamposPage() {
  const fn = useServerFn(listLocations);
  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const renderStars = (rating: number | null | undefined) => {
    const r = Math.round((rating ?? 0) * 2) / 2;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i <= r
                ? "fill-yellow-400 text-yellow-400"
                : i - 0.5 === r
                ? "fill-yellow-400/50 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{rating ?? "0"}/5</span>
      </div>
    );
  };

  return (
    <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Campos</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo cadastrado ainda.</p>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((l: any) => (
            <Card key={l.id} className="bg-card overflow-hidden">
              {l.photo_url ? (
                <img
                  src={l.photo_url}
                  alt={l.name}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-lg">{l.name}</div>

                {l.address && (
                  <div className="text-sm text-muted-foreground flex items-start gap-1">
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{l.address}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {l.phone && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{l.phone}</span>
                    </div>
                  )}
                  {l.price_per_hour !== null && l.price_per_hour !== undefined && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>R$ {Number(l.price_per_hour).toFixed(2)}/h</span>
                    </div>
                  )}
                  {l.opening_hours && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{l.opening_hours}</span>
                    </div>
                  )}
                  {l.rating !== null && l.rating !== undefined && (
                    <div className="flex items-center gap-1">
                      {renderStars(l.rating)}
                    </div>
                  )}
                </div>

                {l.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                    {l.notes}
                  </p>
                )}

                {l.maps_url && (
                  <a
                    href={l.maps_url}
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
    </div>
  );
}