import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantDataForm } from '@/modules/settings/view-models/useTenantDataViewModel';
import { formatCep } from '@/shared/lib/masks';

export function TenantAddressTab({
  register,
  onZipcodeChange,
}: {
  register: UseFormRegister<TenantDataForm>;
  onZipcodeChange?: (cep: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[180px_1fr_140px]">
        <div className="space-y-2">
          <Label htmlFor="zipcode">CEP</Label>
          <Input
            id="zipcode"
            inputMode="numeric"
            placeholder="00000-000"
            {...register('zipcode', {
              onChange: (event) => {
                event.target.value = formatCep(event.target.value);
                onZipcodeChange?.(event.target.value);
              },
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="street">Rua / avenida</Label>
          <Input id="street" placeholder="Ex: Avenida Paulista" {...register('street')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="streetNumber">número</Label>
          <Input id="streetNumber" placeholder="1000" {...register('streetNumber')} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_120px]">
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" placeholder="Centro" {...register('neighborhood')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" placeholder="Sao Paulo" {...register('city')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">UF</Label>
          <Input
            id="state"
            maxLength={2}
            placeholder="SP"
            {...register('state', {
              onChange: (event) => {
                event.target.value = event.target.value
                  .replace(/[^a-z]/gi, '')
                  .slice(0, 2)
                  .toUpperCase();
              },
            })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Como esse bloco será usado</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Endereço e contexto do tenant alimentam a tela da empresa, respostas da IA,
          comunicação comercial e futuras integrações operacionais.
        </p>
      </div>
    </div>
  );
}
