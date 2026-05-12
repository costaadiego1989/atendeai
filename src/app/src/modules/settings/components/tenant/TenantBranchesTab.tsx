import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Instagram,
  MessageCircle,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { formatCep, formatCnpj, formatPhone } from '@/shared/lib/masks';
import type { TenantBranch } from '@/shared/types';
import {
  companySettingsService,
  type TenantBranchInput,
} from '@/modules/settings/services/company-settings-service';
import { ScrollArea } from '@/components/ui/scroll-area';

type BranchWhatsAppProvider = 'BUBBLEWHATS' | 'TWILIO' | 'D360';

function emptyBranchForm(): TenantBranchInput {
  return {
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    whatsappNumber: '',
    instagramAccountId: '',
    whatsAppConfigOverride: null,
    zipcode: '',
    street: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    state: '',
    isHeadquarters: false,
    active: true,
  };
}

function toBranchForm(branch: TenantBranch): TenantBranchInput {
  return {
    name: branch.name,
    cnpj: branch.cnpj ?? '',
    phone: branch.phone ?? '',
    email: branch.email ?? '',
    whatsappNumber: branch.whatsappNumber ?? '',
    instagramAccountId: branch.instagramAccountId ?? '',
    whatsAppConfigOverride: branch.whatsAppConfigOverride ?? null,
    zipcode: branch.zipcode ?? '',
    street: branch.street ?? '',
    streetNumber: branch.streetNumber ?? '',
    neighborhood: branch.neighborhood ?? '',
    city: branch.city ?? '',
    state: branch.state ?? '',
    operatingHours: branch.operatingHours ?? null,
    isHeadquarters: branch.isHeadquarters,
    active: branch.active,
  };
}

function formatBranchAddress(branch: TenantBranch) {
  return [branch.street, branch.streetNumber, branch.neighborhood, branch.city, branch.state]
    .filter(Boolean)
    .join(' · ');
}

function formatBranchOverrideSummary(branch: TenantBranch) {
  if (!branch.whatsAppConfigOverride) {
    return null;
  }

  return `Canal local ${branch.whatsAppConfigOverride.provider}`;
}

export function TenantBranchesTab({
  tenantId,
  branches,
}: {
  tenantId?: string;
  branches: TenantBranch[];
}) {
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<TenantBranchInput>(emptyBranchForm());

  const editingBranch = useMemo(
    () => branches.find((branch) => branch.id === editingBranchId) ?? null,
    [branches, editingBranchId],
  );

  function updateForm<K extends keyof TenantBranchInput>(key: K, value: TenantBranchInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingBranchId(null);
    setForm(emptyBranchForm());
    setIsSheetOpen(true);
  }

  function openEdit(branch: TenantBranch) {
    setEditingBranchId(branch.id);
    setForm(toBranchForm(branch));
    setIsSheetOpen(true);
  }

  async function refreshSettings() {
    await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
    const { authService } = await import('@/modules/auth/services/auth-service');
    const { useAuthStore } = await import('@/shared/stores/auth-store');

    try {
      const session = await authService.getCurrentSession();
      useAuthStore.getState().setSession(session.user, session.tenant);
    } catch (e) {
      console.error('Failed to sync session after branch update', e);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !form.name?.trim()) {
      return;
    }

    try {
      setIsSaving(true);

      const submissionData = {
        ...form,
        cnpj: form.cnpj?.replace(/\D/g, '') || null,
      };

      if (editingBranchId) {
        await companySettingsService.updateBranch(tenantId, editingBranchId, submissionData);
      } else {
        await companySettingsService.createBranch(tenantId, submissionData);
      }

      await refreshSettings();
      setIsSheetOpen(false);
      setEditingBranchId(null);
      setForm(emptyBranchForm());

      toast({
        title: editingBranchId ? 'Filial atualizada' : 'Filial cadastrada',
        description: 'A estrutura operacional da empresa foi atualizada com sucesso.',
      });
    } catch (error) {
      toast({
        title: editingBranchId ? 'Falha ao atualizar filial' : 'Falha ao cadastrar filial',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel salvar os dados da filial agora.',
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!tenantId || !editingBranchId) {
      return;
    }

    if (!window.confirm('Deseja excluir esta filial?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await companySettingsService.deleteBranch(tenantId, editingBranchId);
      await refreshSettings();
      setIsSheetOpen(false);
      setEditingBranchId(null);
      setForm(emptyBranchForm());

      toast({
        title: 'Filial removida',
        description: 'A filial foi removida da estrutura operacional da conta.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao excluir filial',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'não foi possivel excluir a filial agora.',
        }),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Filiais e unidades</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre as lojas e operações fisicas da empresa para preparar o produto para
            atendimento por unidade.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova filial
        </Button>
      </div>

      {branches.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {branches.map((branch) => (
            <Card key={branch.id} className="glass-card border-border/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-foreground">
                      {branch.name}
                    </p>
                    {branch.isHeadquarters ? <Badge variant="secondary">Matriz</Badge> : null}
                    {!branch.active ? <Badge variant="outline">Inativa</Badge> : null}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {branch.phone ? <p>{formatPhone(branch.phone)}</p> : null}
                    {branch.email ? <p>{branch.email}</p> : null}
                    {branch.whatsappNumber ? (
                      <p className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {formatPhone(branch.whatsappNumber)}
                      </p>
                    ) : null}
                    {branch.instagramAccountId ? (
                      <p className="flex items-center gap-2">
                        <Instagram className="h-3.5 w-3.5" />
                        {branch.instagramAccountId}
                      </p>
                    ) : null}
                    {formatBranchOverrideSummary(branch) ? (
                      <p className="flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5" />
                        {formatBranchOverrideSummary(branch)}
                      </p>
                    ) : null}
                    {formatBranchAddress(branch) ? <p>{formatBranchAddress(branch)}</p> : null}
                  </div>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(branch)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-base font-medium text-foreground">Nenhuma filial cadastrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Para empresas com mais de uma loja, esta area organiza a estrutura operacional
            desde agora.
          </p>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingBranch ? 'Editar filial' : 'Nova filial'}</SheetTitle>
            <SheetDescription>
              Cadastre o nome, os dados de contato e o endereço da unidade operacional.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex h-[calc(100vh-180px)] flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">Nome da filial</Label>
                    <Input
                      id="branch-name"
                      value={form.name ?? ''}
                      onChange={(event) => updateForm('name', event.target.value)}
                      placeholder="Ex: Loja Copacabana"
                      className="bg-muted/50"
                    />
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="branch-phone">Telefone</Label>
                      <Input
                        id="branch-phone"
                        value={form.phone ?? ''}
                        onChange={(event) => updateForm('phone', formatPhone(event.target.value))}
                        placeholder="(21) 99999-9999"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-email">Email</Label>
                      <Input
                        id="branch-email"
                        value={form.email ?? ''}
                        onChange={(event) => updateForm('email', event.target.value)}
                        placeholder="loja@empresa.com"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Canais Locais
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="branch-whatsapp">WhatsApp da filial</Label>
                      <Input
                        id="branch-whatsapp"
                        value={form.whatsappNumber ?? ''}
                        onChange={(event) =>
                          updateForm('whatsappNumber', formatPhone(event.target.value))
                        }
                        placeholder="(21) 99999-9999"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-instagram">Instagram da filial</Label>
                      <Input
                        id="branch-instagram"
                        value={form.instagramAccountId ?? ''}
                        readOnly
                        disabled
                        placeholder="Não configurado"
                        className="bg-muted/50"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Configure via <a href="/app/settings/channels" className="text-primary underline">Canais</a> para garantir a conexão OAuth Meta.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h4 className="text-sm font-semibold text-foreground">identificação e Endereço</h4>
                  <div className="space-y-2">
                    <Label htmlFor="branch-cnpj">CNPJ da filial</Label>
                    <Input
                      id="branch-cnpj"
                      value={form.cnpj ?? ''}
                      disabled={Boolean(editingBranchId)}
                      readOnly={Boolean(editingBranchId)}
                      onChange={(event) => updateForm('cnpj', formatCnpj(event.target.value))}
                      placeholder="00.000.000/0000-00"
                      className="bg-muted/50"
                    />
                    {editingBranchId && (
                      <p className="text-[10px] text-muted-foreground">
                        CNPJ da filial fica travado apos o cadastro.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor="branch-zipcode">CEP</Label>
                      <Input
                        id="branch-zipcode"
                        value={form.zipcode ?? ''}
                        onChange={(event) => updateForm('zipcode', formatCep(event.target.value))}
                        placeholder="00000-000"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-street">Rua / avenida</Label>
                      <Input
                        id="branch-street"
                        value={form.street ?? ''}
                        onChange={(event) => updateForm('street', event.target.value)}
                        placeholder="Ex: Avenida Atlantica"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_80px]">
                    <div className="space-y-2">
                      <Label htmlFor="branch-neighborhood">Bairro</Label>
                      <Input
                        id="branch-neighborhood"
                        value={form.neighborhood ?? ''}
                        onChange={(event) => updateForm('neighborhood', event.target.value)}
                        placeholder="Centro"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-city">Cidade</Label>
                      <Input
                        id="branch-city"
                        value={form.city ?? ''}
                        onChange={(event) => updateForm('city', event.target.value)}
                        placeholder="Rio de Janeiro"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-state">UF</Label>
                      <Input
                        id="branch-state"
                        maxLength={2}
                        value={form.state ?? ''}
                        onChange={(event) =>
                          updateForm(
                            'state',
                            event.target.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase(),
                          )
                        }
                        placeholder="RJ"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">Marcar como matriz</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        A unidade principal é o coração da operação.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(form.isHeadquarters)}
                      onCheckedChange={(checked) => updateForm('isHeadquarters', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-muted/30 border border-border/40">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">Unidade ativa</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Habilita recursos automatizados para esta loja.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(form.active)}
                      onCheckedChange={(checked) => updateForm('active', checked)}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="pt-6 border-t border-border/40 bg-background/50 backdrop-blur-sm mt-auto">
              {editingBranch && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button type="submit" className="flex-1 sm:flex-none" disabled={isSaving}>
                {isSaving ? 'Salvando...' : editingBranch ? 'Salvar Alterações' : 'Cadastrar Filial'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
