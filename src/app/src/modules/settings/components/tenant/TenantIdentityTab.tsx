import { useState } from 'react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { FileText, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBusinessTypeLabel } from '@/shared/constants/business-types';
import { formatCnpj, formatCpf, formatPhone } from '@/shared/lib/masks';
import type { Tenant, TenantOwner } from '@/shared/types';
import type { TenantDataForm } from '@/modules/settings/view-models/useTenantDataViewModel';

export function TenantIdentityTab({
  register,
  watch,
  setValue,
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
  const [isUploading, setIsUploading] = useState(false);
  const catalogFiles = watch('catalogFiles') || [];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenantData?.id) return;

    if (file.type !== 'application/pdf') {
      event.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      const { imageUrl: fileUrl } = await catalogService.uploadImage(tenantData.id, file);

      const currentFiles = watch('catalogFiles') || [];
      setValue('catalogFiles', [...currentFiles, fileUrl], { shouldDirty: true });
      await companySettingsService.upsertPDFResume(tenantData.id, {
        fileName: file.name,
        fileUrl,
        summaries: [
          `Documento "${file.name}" enviado para a base de conhecimento da empresa. Use este PDF como contexto informativo em atendimentos automaticos assim que a extracao completa estiver disponivel.`,
        ],
      });
    } catch (error) {
      console.error('Falha ao subir PDF:', error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const removeFile = (url: string) => {
    setValue(
      'catalogFiles',
      catalogFiles.filter((f) => f !== url),
      { shouldDirty: true }
    );
  };
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
            CNPJ e identidade fiscal ficam travados apos o cadastro inicial.
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
          Definido no cadastro inicial. Este dado direciona regras internas,
          prompts e jornadas do produto.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ownerName">responsável da conta</Label>
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

      <div className="space-y-3 border-t border-border/40 pt-5">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Arquivo(s) PDF</Label>
          {isBranchScope ? (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Somente leitura (Matriz)
            </span>
          ) : (
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
              {catalogFiles.length} arquivo(s)
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {catalogFiles.map((url, index) => (
            <div
              key={url}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-bold text-foreground">
                    Catálogo PDF {index + 1}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Documento de referência para IA
                  </span>
                </div>
                {!isBranchScope && (
                  <button
                    type="button"
                    onClick={() => removeFile(url)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Remover catálogo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="h-8 flex-1 rounded-lg text-[11px] font-semibold"
                >
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Visualizar PDF
                  </a>
                </Button>
              </div>
            </div>
          ))}

          {!isBranchScope && (
            <div className="relative">
              <input
                type="file"
                id="pdf-upload"
                accept=".pdf"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileUpload}
                disabled={isUploading || !tenantData?.id}
              />
              <div className={cn(
                "flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all",
                isUploading
                  ? "border-primary/40 bg-primary/5 opacity-50"
                  : "border-border/60 bg-muted/5 hover:border-primary/40 hover:bg-muted/10"
              )}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground">Enviando catálogo...</span>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-muted/20 p-2">
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground text-center px-4">
                      Clique ou arraste para<br />subir novo PDF
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-primary/5 p-3 flex gap-3 border border-primary/10">
          <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-primary">i</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Os arquivos PDF são fundamentais para o cérebro da sua IA.
            <strong> {tenantData?.name}</strong> utiliza esses documentos para extrair preços,
            detalhes técnicos e condições comerciais durante os atendimentos automáticos.
          </p>
        </div>
      </div>
    </div>
  );
}
