import { useState } from 'react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { FileText, Loader2, Trash2, UploadCloud, CheckCircle2, AlertCircle, Brain } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogService } from '@/modules/catalog/services/catalog-service';
import { companySettingsService, TenantPDFResume } from '@/modules/settings/services/company-settings-service';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
  const [togglingUrl, setTogglingUrl] = useState<string | null>(null);
  const catalogFiles = watch('catalogFiles') || [];
  const queryClient = useQueryClient();

  const { data: pdfResumes = [] } = useQuery({
    queryKey: ['tenant-pdf-resumes', tenantData?.id],
    queryFn: () => companySettingsService.listPDFResumes(tenantData!.id),
    enabled: Boolean(tenantData?.id),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasProcessing = data.some(
        (r) => ['PROCESSING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING'].includes(r.status),
      );
      return hasProcessing ? 5_000 : false;
    },
  });

  const getPDFResume = (url: string) => pdfResumes.find((r) => r.fileUrl === url);

  const handleToggleCanSendIt = async (url: string, current: boolean) => {
    if (!tenantData?.id) return;
    const resume = getPDFResume(url);
    setTogglingUrl(url);
    try {
      await companySettingsService.upsertPDFResume(tenantData.id, {
        fileName: resume?.fileName ?? url.split('/').pop() ?? 'documento.pdf',
        fileUrl: url,
        summaries: resume?.summaries,
        canSendIt: !current,
      });
      await queryClient.invalidateQueries({ queryKey: ['tenant-pdf-resumes', tenantData.id] });
    } catch (error) {
      console.error('Falha ao atualizar permissão de envio:', error);
    } finally {
      setTogglingUrl(null);
    }
  };

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
          `Documento "${file.name}" enviado para a base de conhecimento da empresa. Use este PDF como contexto informativo em atendimentos automáticos assim que a extração estiver disponível.`,
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

  const getStatusConfig = (resume: TenantPDFResume | undefined) => {
    if (!resume) return null;
    const statusMap: Record<string, { label: string; color: string; animate?: boolean }> = {
      PROCESSING: { label: 'Processando...', color: 'text-amber-600', animate: true },
      EXTRACTING: { label: 'Extraindo texto...', color: 'text-amber-600', animate: true },
      CHUNKING: { label: 'Dividindo em blocos...', color: 'text-amber-600', animate: true },
      EMBEDDING: { label: 'Gerando embeddings...', color: 'text-amber-600', animate: true },
      READY: { label: 'Indexado', color: 'text-emerald-600' },
      ERROR: { label: 'Erro no processamento', color: 'text-red-500' },
    };
    return statusMap[resume.status] ?? { label: resume.status, color: 'text-muted-foreground' };
  };

  const totalChunks = pdfResumes
    .filter((r) => r.status === 'READY')
    .reduce((sum, r) => sum + (r.chunkCount ?? 0), 0);

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
          {catalogFiles.map((url, index) => {
            const resume = getPDFResume(url);
            const canSendIt = resume?.canSendIt ?? false;
            const isToggling = togglingUrl === url;

            return (
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
                      {resume?.fileName ?? `Catálogo PDF ${index + 1}`}
                    </span>
                    {(() => {
                      const statusConfig = getStatusConfig(resume);
                      if (!statusConfig) return (
                        <span className="truncate text-[11px] text-muted-foreground">
                          Documento de referência para IA
                        </span>
                      );
                      return (
                        <span className={cn('flex items-center gap-1 text-[11px]', statusConfig.color)}>
                          {statusConfig.animate && <Loader2 className="h-3 w-3 animate-spin" />}
                          {resume?.status === 'READY' && <CheckCircle2 className="h-3 w-3" />}
                          {resume?.status === 'ERROR' && <AlertCircle className="h-3 w-3" />}
                          {statusConfig.label}
                          {resume?.status === 'READY' && resume.chunkCount > 0 && (
                            <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {resume.chunkCount} blocos
                            </span>
                          )}
                        </span>
                      );
                    })()}
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

                {!isBranchScope && (
                  <div className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2 transition-colors',
                    canSendIt
                      ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                      : 'border-border/50 bg-background/40',
                  )}>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-foreground">
                        IA pode enviar link ao cliente
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {canSendIt
                          ? 'Link enviado quando solicitado'
                          : 'Somente contexto interno'}
                      </span>
                    </div>
                    <Switch
                      checked={canSendIt}
                      disabled={isToggling}
                      onCheckedChange={() => handleToggleCanSendIt(url, canSendIt)}
                      aria-label="Permitir IA enviar link do PDF ao cliente"
                    />
                  </div>
                )}
              </div>
            );
          })}

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

        {totalChunks > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Brain className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-emerald-700">
                Base inteligente ativa
              </span>
              <span className="text-[11px] text-muted-foreground">
                {totalChunks} blocos indexados para respostas contextuais
              </span>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-primary/5 p-3 flex gap-3 border border-primary/10">
          <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-primary">i</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Esses documentos são usados pela IA para responder perguntas sobre sua empresa.
            <strong> {tenantData?.name}</strong> utiliza esses documentos para extrair preços,
            detalhes técnicos e condições comerciais durante os atendimentos automáticos.
          </p>
        </div>
      </div>
    </div>
  );
}
