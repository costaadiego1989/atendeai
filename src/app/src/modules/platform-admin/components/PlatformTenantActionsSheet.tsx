import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { platformAdminService } from '../services/platform-admin.service';
import { platformTenantsQueryKeyRoot } from '../view-models/usePlatformTenantsPageViewModel';
import type { PlatformTenantOverviewItemDto } from '../types/platform-admin.types';

function buildTenantSummary(row: PlatformTenantOverviewItemDto): string {
  return [
    `Empresa: ${row.companyName}`,
    `CNPJ: ${row.cnpj}`,
    `Plano tenant: ${row.tenantPlan} (${row.tenantPlanStatus})`,
    row.subscription
      ? `Assinatura: ${row.subscription.plan} / ${row.subscription.status}`
      : 'Sem assinatura',
    `Quotas limite atual: msgs ${row.quotas.messages.limit}, IA ${row.quotas.aiTokens.limit}, contatos ${row.quotas.contacts.limit}`,
    `Uso no ciclo: msgs ${row.usage.messages.used}, IA ${row.usage.aiTokens.used}, contatos ${row.usage.contacts.used}`,
  ].join('\n');
}

function parseDelta(raw: string): number | undefined {
  const s = raw.trim();
  if (s === '' || s === '-') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

interface PlatformTenantActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: PlatformTenantOverviewItemDto | null;
}

export function PlatformTenantActionsSheet({
  open,
  onOpenChange,
  tenant,
}: PlatformTenantActionsSheetProps) {
  const queryClient = useQueryClient();
  const [deltaMessages, setDeltaMessages] = useState('');
  const [deltaAiTokens, setDeltaAiTokens] = useState('');
  const [deltaContacts, setDeltaContacts] = useState('');
  const [tenantSummary, setTenantSummary] = useState('');
  const [intent, setIntent] = useState<'QUOTA_WARNING' | 'CUSTOM'>('QUOTA_WARNING');
  const [operatorHint, setOperatorHint] = useState('');
  const [draftedText, setDraftedText] = useState('');
  const [sendText, setSendText] = useState('');

  useEffect(() => {
    if (!open || !tenant) return;
    setDeltaMessages('');
    setDeltaAiTokens('');
    setDeltaContacts('');
    setTenantSummary(buildTenantSummary(tenant));
    setIntent('QUOTA_WARNING');
    setOperatorHint('');
    setDraftedText('');
    setSendText('');
  }, [open, tenant?.tenantId, tenant]);

  const patchMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('Sem tenant');
      const body: { messages?: number; aiTokens?: number; contacts?: number } = {};
      const dm = parseDelta(deltaMessages);
      const dai = parseDelta(deltaAiTokens);
      const dc = parseDelta(deltaContacts);
      if (dm !== undefined) body.messages = dm;
      if (dai !== undefined) body.aiTokens = dai;
      if (dc !== undefined) body.contacts = dc;
      if (Object.keys(body).length === 0) {
        throw new Error('Informe pelo menos um ajuste numérico (delta).');
      }
      return platformAdminService.patchTenantQuotas(tenant.tenantId, body);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [...platformTenantsQueryKeyRoot] });
      toast({
        title: 'Quotas atualizadas',
        description: `Novos limites: msgs ${data.quotas.messages}, IA ${data.quotas.aiTokens}, contatos ${data.quotas.contacts}.`,
      });
      setDeltaMessages('');
      setDeltaAiTokens('');
      setDeltaContacts('');
    },
    onError: (e) => {
      toast({
        title: 'Falha ao ajustar quotas',
        description: getFriendlyErrorMessage(e, {
          fallbackMessage: 'Tente novamente.',
          context: 'platform-admin',
        }),
        variant: 'destructive',
      });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('Sem tenant');
      const summary = tenantSummary.trim();
      if (summary.length < 8) {
        throw new Error('Contexto do tenant deve ter pelo menos 8 caracteres.');
      }
      return platformAdminService.draftTenantMessage(tenant.tenantId, {
        intent,
        tenantSummary: summary,
        ...(intent === 'CUSTOM' ? { operatorHint: operatorHint.trim() || undefined } : {}),
      });
    },
    onSuccess: (data) => {
      setDraftedText(data.text);
      setSendText(data.text);
      toast({ title: 'Rascunho gerado', description: 'Revise antes de enviar pelo WhatsApp.' });
    },
    onError: (e) => {
      toast({
        title: 'Falha no rascunho',
        description: getFriendlyErrorMessage(e, {
          fallbackMessage: 'Não foi possível gerar o rascunho agora.',
          context: 'platform-admin',
        }),
        variant: 'destructive',
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('Sem tenant');
      const text = (sendText.trim() || draftedText.trim());
      if (!text) throw new Error('Digite a mensagem para enviar.');
      return platformAdminService.sendTenantManualMessage(tenant.tenantId, text);
    },
    onSuccess: () => {
      toast({
        title: 'Mensagem enfileirada',
        description: 'O WhatsApp será enviado conforme fila da operação.',
      });
      onOpenChange(false);
    },
    onError: (e) => {
      toast({
        title: 'Falha ao enviar',
        description: getFriendlyErrorMessage(e, {
          fallbackMessage: 'Verifique número do proprietário ou fila.',
          context: 'platform-admin',
        }),
        variant: 'destructive',
      });
    },
  });

  function submitSend(): void {
    void sendMutation.mutateAsync();
  }

  const hasSubscription = Boolean(tenant?.subscription);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-xl flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Ações do tenant</SheetTitle>
          <SheetDescription>
            {tenant
              ? `${tenant.companyName} — ajustes somam aos limites atuais da assinatura (API PATCH). WhatsApp vai ao proprietário.`
              : 'Selecione um tenant.'}
          </SheetDescription>
        </SheetHeader>

        {tenant ? (
          <>
            <Tabs defaultValue="quotas" className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quotas">Quotas</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              </TabsList>

              <TabsContent value="quotas" className="space-y-4">
                {!hasSubscription ? (
                  <p className="text-sm text-muted-foreground">
                    Sem assinatura ativa registrada para este tenant — o ajuste de quotas pode falhar na API até existir subscription.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Valores são <strong>deltas</strong>: ex. <code className="text-foreground">+500</code> soma ao limite atual
                  de mensagens; <code className="text-foreground">-100</code> reduz.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="d-msg">Delta mensagens</Label>
                    <Input
                      id="d-msg"
                      inputMode="numeric"
                      placeholder="ex: 500 ou -50"
                      value={deltaMessages}
                      onChange={(e) => setDeltaMessages(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-ia">Delta tokens IA</Label>
                    <Input
                      id="d-ia"
                      inputMode="numeric"
                      placeholder="opcional"
                      value={deltaAiTokens}
                      onChange={(e) => setDeltaAiTokens(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-ct">Delta contatos</Label>
                    <Input
                      id="d-ct"
                      inputMode="numeric"
                      placeholder="opcional"
                      value={deltaContacts}
                      onChange={(e) => setDeltaContacts(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={patchMutation.isPending || !hasSubscription}
                  className="w-full sm:w-auto"
                  onClick={() => void patchMutation.mutateAsync()}
                >
                  {patchMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aplicando…
                    </>
                  ) : (
                    'Aplicar deltas de quota'
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-4">
                <div className="space-y-2">
                  <Label>Intenção do rascunho</Label>
                  <Select
                    value={intent}
                    onValueChange={(v) => setIntent(v as 'QUOTA_WARNING' | 'CUSTOM')}
                  >
                    <SelectTrigger className="w-full sm:max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUOTA_WARNING">Alerta de quota</SelectItem>
                      <SelectItem value="CUSTOM">Instruções do operador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {intent === 'CUSTOM' ? (
                  <div className="space-y-2">
                    <Label htmlFor="op-hint">Instrução para a IA</Label>
                    <Textarea
                      id="op-hint"
                      rows={3}
                      placeholder="Ex.: Peça cortesia ao cliente para reduzir volume de broadcasts."
                      value={operatorHint}
                      onChange={(e) => setOperatorHint(e.target.value)}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="tenant-sum">Contexto do tenant</Label>
                  <Textarea
                    id="tenant-sum"
                    rows={8}
                    value={tenantSummary}
                    onChange={(e) => setTenantSummary(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">Mínimo 8 caracteres (validação da API).</p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={draftMutation.isPending}
                  onClick={() => void draftMutation.mutateAsync()}
                >
                  {draftMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando…
                    </>
                  ) : (
                    'Gerar rascunho (IA)'
                  )}
                </Button>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="draft-send">Resultado / mensagem para envio</Label>
                  <Textarea
                    id="draft-send"
                    rows={10}
                    value={sendText || draftedText}
                    onChange={(e) => setSendText(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={sendMutation.isPending || !(sendText.trim() || draftedText.trim())}
                    className="w-full sm:w-auto"
                    onClick={submitSend}
                  >
                    {sendMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      'Enfileirar WhatsApp ao proprietário'
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Envio usa o mesmo pipeline operacional da fila WhatsApp ao dono da conta tenant.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
