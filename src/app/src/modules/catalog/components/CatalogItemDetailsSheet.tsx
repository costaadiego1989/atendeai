import { Boxes, PencilLine, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency, formatSource, formatType, requiresInventoryControl } from '../utils/formatters';

interface CatalogItemDetailsSheetProps {
  item: any | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  isDeleting: boolean;
}

export function CatalogItemDetailsSheet({
  item,
  onOpenChange,
  onEdit,
  onDelete,
  isDeleting,
}: CatalogItemDetailsSheetProps) {
  const navigate = useNavigate();

  if (!item) return null;

  const attributes = Object.entries(item.attributes ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  const variants = item.variants ?? [];
  const optionGroups = item.optionGroups ?? [];
  const categoryLabel =
    Array.isArray(item.categoryPath) && item.categoryPath.length > 0
      ? item.categoryPath.join(' / ')
      : item.categoryName || 'Sem categoria';
  const getVariantAttributes = (variant: Record<string, unknown>) => {
    const attributes =
      variant.attributes && typeof variant.attributes === 'object'
        ? (variant.attributes as Record<string, unknown>)
        : {};

    return Object.entries(attributes).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );
  };

  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>
            Detalhe operacional do item dentro do catalogo atual.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {item.imageUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Oferta</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{item.name}</p>
              </div>
              <StatusBadge status={item.active ? 'ACTIVE' : 'CLOSED'} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {item.description || 'Sem descrição comercial registrada.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-card border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</p>
                <p className="mt-2 text-sm font-medium text-foreground">{categoryLabel}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Preço base</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatCurrency(item.basePrice)}</p>
              </CardContent>
            </Card>
          </div>

          {attributes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Campos customizados</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {attributes.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {variants.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Variacoes</p>
              <div className="space-y-3">
                {variants.map((variant: Record<string, unknown>, index: number) => {
                  const variantAttributes = getVariantAttributes(variant);

                  return (
                    <div
                      key={`${variant.reference ?? variant.sku ?? index}`}
                      className="rounded-lg border border-border/60 bg-muted/10 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {String(variant.name ?? `Variação ${index + 1}`)}
                          </p>
                          {variant.reference ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Referencia:{' '}
                              <span className="font-medium text-foreground">
                                {String(variant.reference)}
                              </span>
                            </p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:min-w-[180px]">
                          <div className="rounded-md border border-border/60 bg-background/50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preco</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {variant.price ? formatCurrency(Number(variant.price)) : '-'}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/60 bg-background/50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estoque</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {variant.stock ?? '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {variantAttributes.length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {variantAttributes.map(([key, value]) => (
                            <div key={key} className="rounded-md bg-background/40 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{key}</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Sem caracteristicas adicionais.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {optionGroups.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Opções de venda</p>
              <div className="space-y-3">
                {optionGroups.map((group: Record<string, unknown>, index: number) => {
                  const options = Array.isArray(group.options)
                    ? (group.options as Array<Record<string, unknown>>)
                    : [];

                  return (
                    <div key={`${group.name ?? index}`} className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {String(group.name ?? `Grupo ${index + 1}`)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {group.required ? 'Obrigatório' : 'Opcional'} · mínimo {String(group.min ?? 0)} · máximo {String(group.max ?? 1)}
                          </p>
                        </div>
                        <Badge variant={group.required ? 'secondary' : 'outline'}>
                          {group.required ? 'Obrigatório' : 'Opcional'}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {options.map((option, optionIndex) => (
                          <div
                            key={`${option.name ?? optionIndex}`}
                            className="flex items-center justify-between gap-3 rounded-md bg-background/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {String(option.name ?? `Opção ${optionIndex + 1}`)}
                              </p>
                              {option.sku ? (
                                <p className="text-xs text-muted-foreground">{String(option.sku)}</p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-foreground">
                              {Number(option.priceDelta ?? 0) > 0
                                ? `+ ${formatCurrency(Number(option.priceDelta))}`
                                : 'Sem acréscimo'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Contexto</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{formatType(item.type)}</Badge>
              <Badge variant="outline">{formatSource(item.source)}</Badge>
              {requiresInventoryControl(item.type) ? (
                <Badge variant="outline">Controla estoque</Badge>
              ) : null}
              {item.externalReference ? (
                <Badge variant="outline">{item.externalReference}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {(item.tags ?? []).map((tag: string) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {requiresInventoryControl(item.type) ? (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/app/inventory?catalogItemId=${encodeURIComponent(item.id!)}&name=${encodeURIComponent(item.name)}&externalReference=${encodeURIComponent(item.externalReference ?? '')}&basePrice=${encodeURIComponent(String(item.basePrice ?? ''))}`,
                  )
                }
              >
                <Boxes className="mr-2 h-4 w-4" />
                Criar controle de estoque
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onEdit(item)}>
              <PencilLine className="mr-2 h-4 w-4" />
              Editar item
            </Button>
            {item.active ? (
              <Button
                variant="outline"
                onClick={() => onDelete(item)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? 'Removendo...' : 'Remover item'}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
