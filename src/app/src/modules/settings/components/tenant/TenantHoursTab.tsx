import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { TenantDataForm } from '@/modules/settings/view-models/useTenantDataViewModel';
import { weekdayFields } from './tenant-view-helpers';

export function TenantHoursTab({
  register,
  watch,
  setValue,
}: {
  register: UseFormRegister<TenantDataForm>;
  watch: UseFormWatch<TenantDataForm>;
  setValue: UseFormSetValue<TenantDataForm>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
        <p className="text-sm font-medium text-foreground">horário padrao da operação</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Isso ajuda onboarding, informacoes da empresa e fluxos comerciais. A agenda real de
          profissionais continua no módulo de scheduling.
        </p>
      </div>

      {weekdayFields.map((day, index) => {
        const dayValue = watch(`operatingHours.${day.key}`);

        return (
          <div key={day.key} className="rounded-xl border border-border/60 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{day.label}</p>
                <p className="text-xs text-muted-foreground">
                  {dayValue.closed
                    ? 'Empresa fechada nesse dia.'
                    : 'Empresa operando normalmente.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor={`${day.key}-closed`} className="text-xs text-muted-foreground">
                  Fechado
                </Label>
                <Switch
                  id={`${day.key}-closed`}
                  checked={Boolean(dayValue.closed)}
                  onCheckedChange={(checked) =>
                    setValue(`operatingHours.${day.key}.closed`, checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${day.key}-open`}>Abre</Label>
                <Input
                  id={`${day.key}-open`}
                  type="time"
                  disabled={dayValue.closed}
                  {...register(`operatingHours.${day.key}.open`)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${day.key}-close`}>Fecha</Label>
                <Input
                  id={`${day.key}-close`}
                  type="time"
                  disabled={dayValue.closed}
                  {...register(`operatingHours.${day.key}.close`)}
                />
              </div>
            </div>

            {index !== weekdayFields.length - 1 ? <Separator className="mt-4" /> : null}
          </div>
        );
      })}
    </div>
  );
}
