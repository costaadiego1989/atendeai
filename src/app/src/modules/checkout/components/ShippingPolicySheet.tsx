import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import type { CommerceDeliveryWeekday } from '@/shared/types';

interface ShippingPolicyForm {
  mode: 'FIXED' | 'PER_KM';
  fixedAmount: string;
  pricePerKm: string;
  minimumAmount: string;
  maxRadiusKm: string;
  servicedNeighborhoods: string;
  deliverySchedule: Array<{
    weekday: CommerceDeliveryWeekday;
    enabled: boolean;
    startTime?: string | null;
    endTime?: string | null;
  }>;
  notes: string;
}

interface ShippingPolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ShippingPolicyForm;
  onFormChange: (update: (prev: ShippingPolicyForm) => ShippingPolicyForm) => void;
  onSave: () => void;
  isSaving: boolean;
  getWeekdayLabel: (value: string) => string;
  requestBrowserLocation: () => void;
  mapLoading: boolean;
  companyAddress?: string | null;
  mapEmbedUrl?: string | null;
  mapCoverageDiameter: number;
}

export const ShippingPolicySheet: React.FC<ShippingPolicySheetProps> = ({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  isSaving,
  getWeekdayLabel,
  requestBrowserLocation,
  mapLoading,
  companyAddress,
  mapEmbedUrl,
  mapCoverageDiameter,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl border-l border-border/60">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">Regras de Entrega e Checkout</SheetTitle>
          <SheetDescription>
            Configure como a IA deve calcular o frete e quais são as janelas de entrega do seu negócio.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="shipping-mode" className="text-sm font-semibold">Modelo de Cobrança de Frete</Label>
            <Select
              value={form.mode}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  mode: value as 'FIXED' | 'PER_KM',
                }))
              }
            >
              <SelectTrigger id="shipping-mode" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="FIXED">Taxa Fixa (Padrão)</SelectItem>
                <SelectItem value="PER_KM">Valor por Quilômetro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.mode === 'FIXED' ? (
            <div className="space-y-2">
              <Label htmlFor="shipping-fixed-amount" className="text-sm font-semibold">Valor da Taxa Fixa</Label>
              <Input
                id="shipping-fixed-amount"
                className="h-11 rounded-xl"
                inputMode="decimal"
                value={form.fixedAmount}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    fixedAmount: event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'),
                  }))
                }
                placeholder="Ex: 10.00"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shipping-price-per-km" className="text-sm font-semibold">Valor por KM (R$)</Label>
                  <Input
                    id="shipping-price-per-km"
                    className="h-11 rounded-xl"
                    inputMode="decimal"
                    value={form.pricePerKm}
                    onChange={(event) =>
                      onFormChange((current) => ({
                        ...current,
                        pricePerKm: event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'),
                      }))
                    }
                    placeholder="Ex: 2.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping-minimum-amount" className="text-sm font-semibold">Valor Mínimo (R$)</Label>
                  <Input
                    id="shipping-minimum-amount"
                    className="h-11 rounded-xl"
                    inputMode="decimal"
                    value={form.minimumAmount}
                    onChange={(event) =>
                      onFormChange((current) => ({
                        ...current,
                        minimumAmount: event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'),
                      }))
                    }
                    placeholder="Ex: 5.00"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Raio de Cobertura</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Limite máximo que a operação atende a partir do endereço da sede.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs"
                    onClick={requestBrowserLocation}
                    disabled={mapLoading}
                  >
                    {mapLoading ? 'Sincronizando...' : 'Localizar sede'}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{form.maxRadiusKm} KM de raio</span>
                    <span className="text-muted-foreground">Máx: 30 km</span>
                  </div>
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[Number(form.maxRadiusKm)]}
                    onValueChange={(value) =>
                      onFormChange((current) => ({
                        ...current,
                        maxRadiusKm: String(value[0] ?? 5),
                      }))
                    }
                  />
                </div>

                {mapEmbedUrl && (
                  <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background h-52">
                    <iframe
                      title="Mapa Operacional"
                      src={mapEmbedUrl}
                      className="h-full w-full grayscale opacity-80"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div
                        className="rounded-full border-2 border-primary/40 bg-primary/10 transition-all duration-300"
                        style={{
                          width: `${mapCoverageDiameter}px`,
                          height: `${mapCoverageDiameter}px`,
                        }}
                      />
                      <div className="absolute rounded-full bg-background p-1.5 shadow-lg ring-1 ring-border/20">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/5 p-4">
            <div>
              <p className="text-sm font-bold text-foreground">Janelas de Entrega</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ative os dias e defina os horários que o seu negócio realiza entregas.
              </p>
            </div>

            <div className="space-y-2.5">
              {form.deliverySchedule.map((slot) => (
                <div
                  key={slot.weekday}
                  className={`grid grid-cols-[1fr_auto_2fr] gap-3 items-center rounded-xl border border-border/40 p-2.5 transition-colors ${slot.enabled ? 'bg-background shadow-sm' : 'bg-muted/20 opacity-60'}`}
                >
                  <span className="text-xs font-bold">{getWeekdayLabel(slot.weekday)}</span>
                  <Switch
                    checked={slot.enabled}
                    onCheckedChange={(checked) =>
                      onFormChange((current) => ({
                        ...current,
                        deliverySchedule: current.deliverySchedule.map((entry) =>
                          entry.weekday === slot.weekday ? { ...entry, enabled: checked } : entry
                        ),
                      }))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="h-8 text-[11px] rounded-lg"
                      value={slot.startTime ?? ''}
                      disabled={!slot.enabled}
                      onChange={(e) =>
                        onFormChange((current) => ({
                          ...current,
                          deliverySchedule: current.deliverySchedule.map((entry) =>
                            entry.weekday === slot.weekday ? { ...entry, startTime: e.target.value } : entry
                          ),
                        }))
                      }
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      className="h-8 text-[11px] rounded-lg"
                      value={slot.endTime ?? ''}
                      disabled={!slot.enabled}
                      onChange={(e) =>
                        onFormChange((current) => ({
                          ...current,
                          deliverySchedule: current.deliverySchedule.map((entry) =>
                            entry.weekday === slot.weekday ? { ...entry, endTime: e.target.value } : entry
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping-notes" className="text-sm font-semibold text-foreground">Observações Técnicas</Label>
            <Textarea
              id="shipping-notes"
              className="rounded-xl min-h-[100px] text-sm"
              value={form.notes}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Ex: Entregas apenas em dias úteis até as 18h. Informar ao cliente que o prazo médio é de 40 minutos após confirmação."
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-border/60 pt-6">
            <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="h-11 rounded-xl px-8 font-bold"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? 'Gravando...' : 'Salvar Regras'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
