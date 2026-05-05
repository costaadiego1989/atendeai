import { Building2, MapPin } from 'lucide-react';

type ProspectingSearchRadarPreviewProps = {
  businessTypeQuery?: string;
  city?: string;
  neighborhood?: string;
  state?: string;
  maxResults?: string;
};

function buildTerritory(city?: string, neighborhood?: string, state?: string) {
  return [neighborhood, city, state].filter(Boolean).join(', ');
}

export function ProspectingSearchRadarPreview({
  businessTypeQuery,
  city,
  neighborhood,
  state,
  maxResults,
}: ProspectingSearchRadarPreviewProps) {
  const territory = buildTerritory(city, neighborhood, state);
  const hasLocation = Boolean(territory);
  const mapQuery = encodeURIComponent(
    [businessTypeQuery, territory].filter(Boolean).join(', '),
  );
  const mapSrc = hasLocation
    ? `https://www.google.com/maps?q=${mapQuery}&z=13&output=embed`
    : null;

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.10),transparent_42%),linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.45)_100%)]">
      <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
        <div className="overflow-hidden rounded-3xl border border-primary/15 bg-background/60">
          {mapSrc ? (
            <div className="relative h-[320px]">
              <iframe
                title="Mapa da região alvo da busca"
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-primary/15 bg-background/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-primary shadow-sm backdrop-blur">
                Região alvo
              </div>
            </div>
          ) : (
            <div className="flex h-[320px] items-center justify-center px-6 text-center">
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MapPin className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Defina a localidade da busca
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assim que cidade, bairro ou estado forem preenchidos, o mapa aparece aqui.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Alvo da busca
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {businessTypeQuery?.trim() || 'Defina o tipo de negócio'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {territory || 'Cidade, bairro e estado aparecem aqui para guiar a captação.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-[0.18em]">
                  Localidade
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {territory || 'Aguardando definição'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-[0.18em]">
                  Captação
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                Até {maxResults || '20'} empresas
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
            Use o mapa para validar a região antes de consultar o Google Places e gerar a lista de empresas.
          </div>
        </div>
      </div>
    </div>
  );
}
