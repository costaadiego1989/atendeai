import { useEffect, useState } from 'react';
import { Bot, CalendarClock, CircleDollarSign, ListOrdered, Loader2, Search, Send, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  recoveryBillingTypeLabels,
  recoveryChargeTypeLabels,
  recoveryStatusLabels,
} from '@/modules/recovery/components/RecoveryLabel';
import { formatCurrencyInput, formatPhone, parseCurrencyInput } from '@/shared/lib/masks';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { TagInput } from '@/shared/ui/TagInput';
import { splitRecoveryTags } from '@/modules/recovery/view-models/useRecoveryViewModelHelper';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';
import type { RecoveryStatus } from '@/shared/types';
import type { RecoveryBillingType } from '@/modules/recovery/services/RecoveryService';

const CHARGE_TYPE_OPTIONS = [
  'MONTHLY_FEE',
  'SERVICE_INVOICE',
  'RENTAL',
  'PRODUCT_ORDER',
  'CONSULTATION',
  'INSTALLMENT',
  'MENTORSHIP',
  'OTHER',
];

const STATUS_OPTIONS: RecoveryStatus[] = [
  'READY_TO_CONTACT',
  'CONTACTED',
  'NEGOTIATING',
  'PROMISE_TO_PAY',
  'NO_RESPONSE',
  'INVALID_CONTACT',
  'PAID',
  'STOPPED',
];

export function RecoveryDialogs({ vm }: { vm: RecoveryPageViewModel }) {
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const debtorReady = Boolean(
    vm.selectedContact || (vm.createForm.debtorName.trim() && vm.createForm.phone.trim()),
  );
  const numericAmount = Number(parseCurrencyInput(vm.createForm.amountDue) || 0);
  const chargeReady = Boolean(
    vm.createForm.chargeType &&
    vm.createForm.chargeTitle.trim() &&
    numericAmount > 0 &&
    vm.createForm.dueDate,
  );
  const createSteps = [
    {
      step: 1 as const,
      title: 'Quem esta devendo?',
      description: 'Escolha um contato do CRM ou preencha manualmente.',
      ready: debtorReady,
    },
    {
      step: 2 as const,
      title: 'O que esta em atraso?',
      description: 'Defina tipo, título, valor e vencimento.',
      ready: chargeReady,
    },
    {
      step: 3 as const,
      title: 'Revisar caso',
      description: 'Finalize o contexto e abra o caso de recovery.',
      ready: false,
    },
  ];

  useEffect(() => {
    if (!vm.createOpen) {
      setCreateStep(1);
      return;
    }

    if (!debtorReady) {
      setCreateStep(1);
      return;
    }

    setCreateStep((current) => (current === 1 ? 2 : current));
  }, [debtorReady, vm.createOpen]);

  return (
    <>
      <Sheet open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
        <SheetContent side="right" className="flex w-[860px] flex-col overflow-y-auto sm:max-w-[860px]">
          <SheetHeader>
            <SheetTitle>Nova cobrança</SheetTitle>
            <SheetDescription>
              Preencha em 3 etapas: devedor, cobrança e revisão do caso.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={String(createStep)}
            onValueChange={(value) => {
              const nextStep = Number(value) as 1 | 2 | 3;
              const available =
                nextStep === 1 ||
                (nextStep === 2 && debtorReady) ||
                (nextStep === 3 && debtorReady && chargeReady);

              if (available) {
                setCreateStep(nextStep);
              }
            }}
            className="mt-6"
          >
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1">
              {createSteps.map((item) => {
                const available =
                  item.step === 1 ||
                  (item.step === 2 && debtorReady) ||
                  (item.step === 3 && debtorReady && chargeReady);

                return (
                  <TabsTrigger
                    key={item.step}
                    value={String(item.step)}
                    disabled={!available}
                    className="min-h-[72px] flex-col items-start justify-center rounded-md px-3 py-2 text-left data-[state=active]:bg-background"
                  >
                    <span className="text-[11px] font-medium uppercase text-muted-foreground">
                      Etapa {item.step}
                    </span>
                    <span className="mt-1 text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="mt-0.5 line-clamp-1 text-xs font-normal text-muted-foreground">
                      {item.ready ? 'Pronto para continuar' : item.description}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {createStep === 1 ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                  Comece escolhendo quem esta em atraso. Se houver contato no CRM, nome, telefone e documento sao reaproveitados automaticamente.
                </div>

                <div className="space-y-4 md:col-span-2">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">Vincular contato do CRM</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <Input
                        value={vm.contactSearch}
                        onChange={(event) => vm.setContactSearch(event.target.value)}
                        placeholder="Buscar por nome, telefone ou email..."
                      />
                      {vm.selectedContact ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
                          <p className="text-sm font-semibold text-foreground">{vm.selectedContact.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatPhone(vm.selectedContact.phone)}
                            {vm.selectedContact.email ? ` · ${vm.selectedContact.email}` : ''}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <StatusBadge status={vm.selectedContact.stage} />
                            <Button variant="outline" size="sm" onClick={vm.clearSelectedContact}>
                              Remover vinculo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-y-auto">
                          {vm.filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => vm.selectContact(contact.id)}
                              className="w-full rounded-2xl border border-border/60 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.04]"
                            >
                              <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatPhone(contact.phone)}
                                {contact.email ? ` · ${contact.email}` : ''}
                              </p>
                            </button>
                          ))}
                          {!vm.contactsQuery.isLoading && vm.filteredContacts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                              Nenhum contato encontrado para essa busca.
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>
                        Nome do devedor
                        {!vm.selectedContact ? ' *' : null}
                      </Label>
                      <Input
                        value={vm.createForm.debtorName}
                        onChange={(event) =>
                          vm.setCreateForm((current) => ({
                            ...current,
                            debtorName: event.target.value,
                          }))
                        }
                        placeholder="Ex: Carlos Inadimplente"
                        disabled={Boolean(vm.selectedContact)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Telefone
                        {!vm.selectedContact ? ' *' : null}
                      </Label>
                      <Input
                        value={vm.createForm.phone}
                        onChange={(event) =>
                          vm.setCreateForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="5511999990000"
                        disabled={Boolean(vm.selectedContact)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Documento</Label>
                      <Input
                        value={vm.createForm.debtorDocument}
                        onChange={(event) =>
                          vm.setCreateForm((current) => ({
                            ...current,
                            debtorDocument: event.target.value,
                          }))
                        }
                        placeholder="CPF ou CNPJ"
                        disabled={Boolean(vm.selectedContact)}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {createStep === 2 ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                  Agora descreva o debito principal. Aqui entram os dados que o financeiro realmente precisa para cobrar.
                </div>
                <div className="space-y-2">
                  <Label>Tipo da cobrança *</Label>
                  <Select
                    value={vm.createForm.chargeType || undefined}
                    onValueChange={(value) =>
                      vm.setCreateForm((current) => ({ ...current, chargeType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHARGE_TYPE_OPTIONS.map((chargeType) => (
                        <SelectItem key={chargeType} value={chargeType}>
                          {recoveryChargeTypeLabels[chargeType] ?? chargeType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa devedora</Label>
                  <Input
                    value={vm.createForm.debtorCompanyName}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        debtorCompanyName: event.target.value,
                      }))
                    }
                    placeholder="Ex: Academia Movimento"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Título da cobrança *</Label>
                  <Input
                    value={vm.createForm.chargeTitle}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        chargeTitle: event.target.value,
                      }))
                    }
                    placeholder="Ex: Mensalidade de julho"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input
                    value={vm.createForm.amountDue}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        amountDue: formatCurrencyInput(event.target.value),
                      }))
                    }
                    placeholder="Ex: 189,90"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento *</Label>
                  <Input
                    type="date"
                    value={vm.createForm.dueDate}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {createStep === 3 ? (
              <>
                <div className="rounded-xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground md:col-span-2">
                  Revise os dados finais do caso e complemente o contexto operacional antes de criar.
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Devedor</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {vm.createForm.debtorName || 'Sem nome informado'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {vm.createForm.phone ? formatPhone(vm.createForm.phone) : 'Sem telefone'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">cobrança</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {vm.createForm.chargeTitle || 'Sem título'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {vm.createForm.amountDue || '0,00'} • {vm.createForm.dueDate || 'Sem vencimento'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Referência externa</Label>
                  <Input
                    value={vm.createForm.externalReference}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        externalReference: event.target.value,
                      }))
                    }
                    placeholder="Ex: ERP-CASE-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <TagInput
                    tags={splitRecoveryTags(vm.createForm.assignedTagsText)}
                    onChange={(tags) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        assignedTagsText: tags.join(', '),
                      }))
                    }
                    placeholder="Ex: atraso-30d, vip"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={vm.createForm.chargeDescription}
                    onChange={(event) =>
                      vm.setCreateForm((current) => ({
                        ...current,
                        chargeDescription: event.target.value,
                      }))
                    }
                    placeholder="Explique o contexto da cobrança."
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setCreateOpen(false)}>
              Cancelar
            </Button>
            {createStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => setCreateStep((current) => (current === 3 ? 2 : 1))}
              >
                Voltar
              </Button>
            ) : null}
            {createStep < 3 ? (
              <Button
                onClick={() => setCreateStep((current) => (current === 1 ? 2 : 3))}
                disabled={(createStep === 1 && !debtorReady) || (createStep === 2 && !chargeReady)}
              >
                Continuar
              </Button>
            ) : (
              <Button
                onClick={() => vm.createCaseMutation.mutate()}
                disabled={vm.createCaseMutation.isPending}
              >
                {vm.createCaseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar caso'
                )}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.outreachOpen} onOpenChange={vm.setOutreachOpen}>
        <SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Contacto ao cliente</SheetTitle>
            <SheetDescription>
              Escolha entre mensagem livre (manual ou IA) ou seguir o <strong>roteiro</strong> do playbook ligado ao caso —
              com regras de prazo e texto gerado conforme cada fase.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <p className="text-sm font-semibold text-foreground">{vm.selectedCase?.debtorName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {vm.selectedCase?.chargeTitle || 'Caso sem título de cobrança'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modo de envio</Label>
              <Select
                value={vm.outreachForm.outreachMode}
                onValueChange={(value: 'free' | 'playbook') =>
                  vm.setOutreachForm((current) => ({
                    ...current,
                    outreachMode: value,
                    previewText: '',
                    previewGeneratedWithAI: false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Mensagem livre (manual ou IA)</SelectItem>
                  <SelectItem value="playbook">Seguir playbook / roteiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vm.outreachForm.outreachMode === 'playbook' && !vm.selectedCase?.playbookId ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Este caso não está ligado a um playbook. Active um playbook na página de recuperação e crie novos casos com{' '}
                <code className="rounded bg-background px-1">RECOVERY_PLAYBOOKS_ENABLED=true</code> na API, ou associe um roteiro
                quando existir essa opção.
              </div>
            ) : null}

            <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary/10 p-2">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Pré-visualização</p>
                    {vm.outreachFlowExhausted ? (
                      <div className="inline-flex rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                        Fluxo de contacto concluído
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {vm.outreachForm.previewText ||
                      (vm.outreachForm.outreachMode === 'playbook'
                        ? 'Gere a prévia da fase actual do roteiro antes de enviar.'
                        : 'Gere uma sugestão com IA ou edite o texto manualmente abaixo.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {vm.outreachForm.outreachMode === 'playbook' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => vm.previewOutreachMutation.mutate('playbook')}
                  disabled={
                    vm.previewOutreachMutation.isPending ||
                    !vm.selectedCase?.playbookId ||
                    vm.outreachFlowExhausted
                  }
                >
                  <ListOrdered className="h-4 w-4" />
                  Pré-visualizar fase do roteiro
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => vm.previewOutreachMutation.mutate('ai')}
                  disabled={vm.previewOutreachMutation.isPending}
                >
                  <Sparkles className="h-4 w-4" />
                  {vm.outreachForm.previewGeneratedWithAI ? 'Gerar outra com IA' : 'Gerar com IA'}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mensagem a enviar</Label>
              <Textarea
                rows={5}
                value={vm.outreachForm.messageText}
                onChange={(event) =>
                  vm.setOutreachForm((current) => ({
                    ...current,
                    messageText: event.target.value,
                  }))
                }
                placeholder={
                  vm.outreachForm.outreachMode === 'playbook'
                    ? 'Use Pré-visualizar fase do roteiro. O envio volta a gerar o texto na API (esta caixa é só leitura).'
                    : 'Edite a mensagem final que sera enviada ao cliente.'
                }
                readOnly={vm.outreachForm.outreachMode === 'playbook'}
              />
              <p className="text-xs text-muted-foreground">
                {vm.outreachForm.outreachMode === 'playbook'
                  ? 'A prévia ajuda a rever o teor; ao confirmar, a API gera novamente conforme a fase (edições aqui não são enviadas).'
                  : 'Você pode aceitar a prévia da IA como está ou ajustar o texto antes de confirmar o envio.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setOutreachOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vm.outreachMutation.mutate()}
              disabled={
                vm.outreachMutation.isPending ||
                vm.outreachFlowExhausted ||
                !vm.outreachForm.messageText.trim() ||
                (vm.outreachForm.outreachMode === 'playbook' && !vm.selectedCase?.playbookId)
              }
            >
              {vm.outreachMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar envio
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.guidanceOpen} onOpenChange={vm.setGuidanceOpen}>
        <SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Atualizar sugestão de resposta</SheetTitle>
            <SheetDescription>
              Use esta tela para recalcular a melhor resposta com base no momento atual da cobrança.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <p className="text-sm font-semibold text-foreground">Sugestão atual</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {vm.selectedCase?.suggestedReply || 'Ainda não existe resposta sugerida para este caso.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Última mensagem do cliente</Label>
              <Textarea
                rows={4}
                value={vm.guidanceForm.customerMessage}
                onChange={(event) =>
                  vm.setGuidanceForm((current) => ({
                    ...current,
                    customerMessage: event.target.value,
                  }))
                }
                placeholder="Ex: consigo parcelar esse valor?"
              />
              <p className="text-xs text-muted-foreground">
                Preencha aqui o que o cliente respondeu para a IA ajustar a sugestão que você vai enviar.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setGuidanceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vm.regenerateGuidanceMutation.mutate()}
              disabled={vm.regenerateGuidanceMutation.isPending}
            >
              {vm.regenerateGuidanceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Atualizar sugestão
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.paymentLinkOpen} onOpenChange={vm.setPaymentLinkOpen}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Enviar cobrança ao cliente</SheetTitle>
            <SheetDescription>
              O sistema gera a cobrança e envia o link automaticamente para o cliente.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <p className="text-sm font-semibold text-foreground">
                {vm.selectedCase?.chargeTitle || 'Cobrança sem título'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Valor atual: {vm.selectedCase?.amountDue != null ? `R$ ${vm.selectedCase.amountDue.toFixed(2)}` : '-'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={vm.paymentLinkForm.billingType}
                onValueChange={(value: RecoveryBillingType) =>
                  vm.setPaymentLinkForm((current) => ({ ...current, billingType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">Pix</SelectItem>
                  <SelectItem value="BOLETO">{recoveryBillingTypeLabels.BOLETO}</SelectItem>
                  <SelectItem value="CREDIT_CARD">{recoveryBillingTypeLabels.CREDIT_CARD}</SelectItem>
                  <SelectItem value="UNDEFINED">{recoveryBillingTypeLabels.UNDEFINED}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setPaymentLinkOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => vm.paymentLinkMutation.mutate()} disabled={vm.paymentLinkMutation.isPending}>
              {vm.paymentLinkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <CircleDollarSign className="mr-2 h-4 w-4" />
                  Gerar e enviar
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.statusOpen} onOpenChange={vm.setStatusOpen}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Atualizar status do caso</SheetTitle>
            <SheetDescription>
              Ajuste o momento operacional da cobrança e, se necessario, agende o proximo follow-up.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={vm.statusForm.status}
                onValueChange={(value: RecoveryStatus) =>
                  vm.setStatusForm((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {recoveryStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vm.statusForm.status === 'PROMISE_TO_PAY' ? (
              <div className="space-y-2">
                <Label>Próxima ação</Label>
                <Input
                  type="datetime-local"
                  value={vm.statusForm.nextActionAt}
                  onChange={(event) =>
                    vm.setStatusForm((current) => ({
                      ...current,
                      nextActionAt: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setStatusOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => vm.updateStatusMutation.mutate()} disabled={vm.updateStatusMutation.isPending}>
              {vm.updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar status'
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.recurringOpen} onOpenChange={vm.setRecurringOpen}>
        <SheetContent side="right" className="w-[720px] sm:max-w-[720px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Recorrência de cobrança</SheetTitle>
            <SheetDescription>
              Agende envios automáticos de cobrança para este caso e acompanhe o status das recorrências.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <p className="text-sm font-semibold text-foreground">
                {vm.selectedCase?.chargeTitle || 'Cobrança sem título'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {vm.selectedCase?.debtorName || 'Devedor não informado'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-primary/10 p-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Agendar nova recorrência</p>
                    <p className="text-xs text-muted-foreground">
                      Defina intervalo, quantidade maxima e opcionalmente uma mensagem personalizada.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Intervalo (dias) *</Label>
                  <Input
                    inputMode="numeric"
                    value={vm.recurringForm.intervalDays}
                    onChange={(event) =>
                      vm.setRecurringForm((current) => ({
                        ...current,
                        intervalDays: event.target.value,
                      }))
                    }
                    placeholder="Ex: 30"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ocorrências máximas</Label>
                  <Input
                    inputMode="numeric"
                    value={vm.recurringForm.maxOccurrences}
                    onChange={(event) =>
                      vm.setRecurringForm((current) => ({
                        ...current,
                        maxOccurrences: event.target.value,
                      }))
                    }
                    placeholder="Ex: 6"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para manter a recorrência ativa até cancelamento manual.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Primeiro disparo (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={vm.recurringForm.firstRunAt}
                    onChange={(event) =>
                      vm.setRecurringForm((current) => ({
                        ...current,
                        firstRunAt: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={vm.recurringForm.billingType}
                    onValueChange={(value: RecoveryBillingType) =>
                      vm.setRecurringForm((current) => ({
                        ...current,
                        billingType: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">Pix</SelectItem>
                      <SelectItem value="BOLETO">{recoveryBillingTypeLabels.BOLETO}</SelectItem>
                      <SelectItem value="CREDIT_CARD">{recoveryBillingTypeLabels.CREDIT_CARD}</SelectItem>
                      <SelectItem value="UNDEFINED">{recoveryBillingTypeLabels.UNDEFINED}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Mensagem personalizada</Label>
                  <Textarea
                    rows={4}
                    value={vm.recurringForm.messageTemplate}
                    onChange={(event) =>
                      vm.setRecurringForm((current) => ({
                        ...current,
                        messageTemplate: event.target.value,
                      }))
                    }
                    placeholder="Ex: Olá! Segue novamente o link para regularizar sua pendência..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Se ficar em branco, o sistema usa o template padrão da cobrança.
                  </p>
                </div>

                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button
                    onClick={() => vm.scheduleRecurringChargeMutation.mutate()}
                    disabled={
                      vm.scheduleRecurringChargeMutation.isPending ||
                      !vm.recurringForm.intervalDays.trim() ||
                      Number(vm.recurringForm.intervalDays) < 1
                    }
                  >
                    {vm.scheduleRecurringChargeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      'Agendar recorrência'
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Recorrências deste caso</p>
                  <p className="text-xs text-muted-foreground">
                    Veja status, próximas execuções e cancele quando necessário.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void vm.recurringChargesQuery.refetch()}
                  disabled={vm.recurringChargesQuery.isFetching}
                >
                  {vm.recurringChargesQuery.isFetching ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {vm.recurringChargesQuery.isLoading ? (
                  <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                    Carregando recorrências...
                  </div>
                ) : (vm.recurringChargesQuery.data ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                    Nenhuma recorrência cadastrada para este caso.
                  </div>
                ) : (
                  (vm.recurringChargesQuery.data ?? []).map((recurrence) => {
                    const isCancelable = recurrence.status === 'ACTIVE' || recurrence.status === 'PAUSED';
                    const max = recurrence.maxOccurrences ?? null;

                    return (
                      <div
                        key={recurrence.id}
                        className="rounded-2xl border border-border/60 bg-muted/10 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {recurrence.status === 'ACTIVE'
                                ? 'Ativa'
                                : recurrence.status === 'PAUSED'
                                  ? 'Pausada'
                                  : recurrence.status === 'COMPLETED'
                                    ? 'Concluída'
                                    : 'Cancelada'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Intervalo: {recurrence.intervalDays} dias • Enviadas: {recurrence.occurrencesSent}
                              {max != null ? ` / ${max}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Próximo disparo:{' '}
                              {recurrence.nextRunAt
                                ? new Date(recurrence.nextRunAt).toLocaleString('pt-BR')
                                : 'não agendado'}
                              {recurrence.lastRunAt
                                ? ` • Último: ${new Date(recurrence.lastRunAt).toLocaleString('pt-BR')}`
                                : ''}
                            </p>
                            {recurrence.lastError ? (
                              <p className="mt-2 text-xs text-destructive">
                                Último erro: {recurrence.lastError}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-2">
                            {isCancelable ? (
                              <>
                                <Input
                                  value={vm.recurringCancelReason}
                                  onChange={(event) => vm.setRecurringCancelReason(event.target.value)}
                                  placeholder="Motivo (opcional)"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() =>
                                    vm.cancelRecurringChargeMutation.mutate({
                                      recurrenceId: recurrence.id,
                                      reason: vm.recurringCancelReason.trim() || undefined,
                                    })
                                  }
                                  disabled={vm.cancelRecurringChargeMutation.isPending}
                                >
                                  {vm.cancelRecurringChargeMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Cancelando...
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4" />
                                      Cancelar
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Não é possível cancelar neste status.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => vm.setRecurringOpen(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
