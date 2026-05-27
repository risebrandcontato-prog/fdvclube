import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Phone,
  Clock,
  DollarSign,
  Star,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { listLocations } from "@/lib/games.functions";

export const Route = createFileRoute("/app/campos")({
  component: CamposPage,
});

function CamposPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listLocations);
  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const renderStars = (rating: number | null | undefined) => {
    const r = Math.round((rating ?? 0) * 2) / 2;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
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
    <div className="min-h-dvh bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold">Campos</h1>
        <p className="text-xs text-muted-foreground">
          {(data ?? []).length} campo{(data ?? []).length !== 1 ? "s" : ""} disponível{(data ?? []).length !== 1 ? "is" : ""}
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="h-36 animate-pulse bg-muted" />
            ))}
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum campo cadastrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">O admin vai adicionar em breve.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(data ?? []).map((l: any) => (
              <button
                key={l.id}
                onClick={() => navigate({ to: "/app/campos/$id", params: { id: l.id } })}
                className="w-full text-left group"
              >
                <Card className="overflow-hidden hover:border-primary/40 transition-colors">
                  {/* Foto */}
                  {l.photo_url ? (
                    <div className="relative h-44">
                      <img
                        src={l.photo_url}
                        alt={l.name}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

                      {/* Nome sobreposto na foto */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h2 className="text-lg font-bold text-white drop-shadow-md">{l.name}</h2>
                      </div>

                      {/* Rating badge */}
                      {l.rating !== null && l.rating !== undefined && (
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-bold text-white">{l.rating}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-36 bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center relative">
                      <MapPin className="h-10 w-10 text-primary/30" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h2 className="text-lg font-bold text-foreground">{l.name}</h2>
                      </div>
                    </div>
                  )}

                  {/* Preview das infos */}
                  <div className="p-3 space-y-2">
                    {l.address && (
                      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                        <span className="line-clamp-1">{l.address}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {l.price_per_hour !== null && l.price_per_hour !== undefined && (
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground bg-primary/10 rounded-md px-2 py-1">
                          <DollarSign className="h-3 w-3 text-primary" />
                          R$ {Number(l.price_per_hour).toFixed(2)}/h
                        </div>
                      )}

                      {l.opening_hours && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {l.opening_hours}
                        </div>
                      )}

                      {l.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {l.phone}
                        </div>
                      )}
                    </div>

                    {/* Ver mais */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-xs font-medium text-primary">Ver detalhes</span>
                      <ChevronRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}