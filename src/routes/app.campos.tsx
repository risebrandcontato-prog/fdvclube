import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listLocations } from "@/lib/games.functions";

export const Route = createFileRoute("/app/campos")({
  component: CamposPage,
});

function CamposPage() {
  const fn = useServerFn(listLocations);
  const { data } = useQuery({ queryKey: ["locations"], queryFn: () => fn() });

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Campos</h1>
      {(data ?? []).map((l) => (
        <Card key={l.id} className="bg-card overflow-hidden">
          {l.photo_url ? (
            <img src={l.photo_url} alt={l.name} className="h-40 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-32 bg-gradient-field" />
          )}
          <div className="p-4">
            <div className="font-semibold">{l.name}</div>
            <div className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{l.address}</span>
            </div>
            {l.maps_url ? (
              <a
                href={l.maps_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary"
              >
                Abrir no Google Maps <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </Card>
      ))}
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum campo cadastrado ainda.</p>
      ) : null}
    </div>
  );
}
