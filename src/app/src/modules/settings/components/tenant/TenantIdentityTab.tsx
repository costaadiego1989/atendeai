import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getBusinessTypeLabel } from '@/shared/constants/business-types';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/lib/masks';
import type { Tenant, TenantOwner } from '@/shared/types';
import type { TenantDataForm } from '@/modules/settings/view-models/useTenantDataViewModel';

export function TenantIdentityTab({
  register,
  watch: _watch,
  setValue: _setValue,
  owner,
  tenantData,
  isBranchScope,
}: {
  register: UseFormRegister<TenantDataForm>;
  watch: UseFormWatch<TenantDataForm>;
  setValue: UseFormSetValue<TenantDataForm>;
  owner?: TenantOwner;
  tenantData?: Tenant;
  isBranchScope?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">Nome da empresa</Label>
          <Input id="companyName" value={tenantData?.name ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={tenantData?.cnpj ? formatCnpj(tenantData.cnpj) : 'não informado'}
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            CNPJ e identidade fiscal ficam travados após o cadastro inicial.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType">Tipo de negócio</Label>
        <Input
          id="businessType"
          value={getBusinessTypeLabel(tenantData?.businessType)}
          disabled
          readOnly
        />
        <p className="text-xs text-muted-foreground">
          Definido no cadastro inicial. Define como a IA se comporta no seu atendimento.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ownerName">Responsável da conta</Label>
          <Input id="ownerName" value={owner?.name ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerCpf">CPF do responsável</Label>
          <Input id="ownerCpf" value={owner?.cpf ? formatCpf(owner.cpf) : ''} disabled />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Email principal</Label>
          <Input id="ownerEmail" value={owner?.email ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerPhone">Telefone principal</Label>
          <Input id="ownerPhone" value={owner?.phone ? formatPhone(owner.phone) : ''} disabled />
        </div>
      </div>

      <div className="space-y-2 lg:max-w-xs">
        <Label htmlFor="ownerBirthDate">Data de nascimento do responsável</Label>
        <Input id="ownerBirthDate" type="date" {...register('ownerBirthDate')} />
        <p className="text-xs text-muted-foreground">
          Usada como fallback no onboarding financeiro da empresa.
        </p>
      </div>

      {isBranchScope ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          Você está editando uma filial. Contexto comercial, catalogo e tipo de
          negócio continuam herdados da Matriz; aqui salvamos apenas dados
          operacionais da unidade.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição comercial</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Explique quem e a empresa, o que vende e qual posicionamento deseja passar."
              {...register('description')}
            />
          </div>
        </>
      )}
    </div>
  );
}
