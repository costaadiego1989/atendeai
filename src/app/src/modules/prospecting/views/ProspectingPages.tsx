import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EmptyState } from '@/shared/ui/EmptyState';
import { AppPagination } from '@/shared/ui/AppPagination';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatPhone } from '@/shared/lib/masks';
import { ProspectingChannelSelector } from '@/modules/prospecting/components/ProspectingChannelSelector';
import { GoogleAdsConnectionCard } from '@/modules/prospecting/components/GoogleAdsConnectionCard';
import { ProspectingMessageSection } from '@/modules/prospecting/components/ProspectingMessageSection';
import { ProspectingSearchRadarPreview } from '@/modules/prospecting/components/ProspectingSearchRadarPreview';
import { ProspectingSearchReportsSheet } from '@/modules/prospecting/components/ProspectingSearchReportsSheet';
import { ProspectingCampaignReportsSheet } from '@/modules/prospecting/components/ProspectingCampaignReportsSheet';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';
import { useGoogleAdsConnectionViewModel } from '@/modules/prospecting/view-models/useGoogleAdsConnectionViewModel';
import { useProspectingAdsInsightsViewModel } from '@/modules/prospecting/view-models/useProspectingAdsInsightsViewModel';
import { useProspectingAdsLeadsViewModel } from '@/modules/prospecting/view-models/useProspectingAdsLeadsViewModel';
import { useProspectingCampaignsViewModel } from '@/modules/prospecting/view-models/useProspectingCampaignsViewModel';
import { useProspectingSearchesViewModel } from '@/modules/prospecting/view-models/useProspectingSearchesViewModel';
import type {
  AdsInsightResult,
  ContactStage,
  ProspectCampaignChannel,
  ProspectLeadImportStatus,
} from '@/shared/types';
import {
  BarChart3,
  AlertTriangle,
  CheckSquare,
  Database,
  ExternalLink,
  Loader2,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Search;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value?: string) {
  if (!value) return 'Agora';
  return new Date(value).toLocaleString('pt-BR');
}

function formatSearchLocation(city: string, state?: string) {
  return [city, state].filter(Boolean).join(' / ');
}

function formatSearchTerritory(city: string, state?: string, neighborhood?: string) {
  return [neighborhood, city, state].filter(Boolean).join(' / ');
}

function formatAudienceType(value: 'REENGAGEMENT' | 'CONTACT_LIST') {
  return value === 'REENGAGEMENT' ? 'Reengajamento' : 'Lista de contatos';
}

function formatChannel(value: ProspectCampaignChannel) {
  return value === 'INSTAGRAM' ? 'Instagram' : 'WhatsApp';
}

function formatLeadImportStatus(value: ProspectLeadImportStatus) {
  switch (value) {
    case 'IMPORTED':
      return 'Importado';
    case 'REUSED':
      return 'Reaproveitado';
    case 'SKIPPED_NO_PHONE':
      return 'Sem canal válido';
    default:
      return 'Novo';
  }
}

function formatInsightType(type: AdsInsightResult['resultType']) {
  switch (type) {
    case 'DEMAND_ESTIMATE':
      return 'Demanda';
    case 'INTEREST':
      return 'Interesse';
    case 'REGION':
      return 'Região';
    case 'KEYWORD_THEME':
      return 'Tema';
    default:
      return type;
  }
}

const CONTACT_STAGE_OPTIONS = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'OPPORTUNITY', label: 'Oportunidade' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'INACTIVE', label: 'Inativo' },
] as const;

function ProspectingPlacesContent({
  vm,
}: {
  vm: ReturnType<typeof useProspectingSearchesViewModel>;
}) {
  const allSelected =
    vm.results.length > 0 && vm.selectedResultIds.length === vm.results.length;

  return (
    <div className="space-y-8">
      <div className="card-grid mb-6">
        <MetricCard
          title="Buscas registradas"
          value={vm.metrics.totalSearches}
          description="Histórico da prospecção local."
          icon={Search}
        />
        <MetricCard
          title="Em andamento"
          value={vm.metrics.runningSearches}
          description="Consultas aguardando retorno da busca."
          icon={Loader2}
        />
        <MetricCard
          title="Concluídas"
          value={vm.metrics.completedSearches}
          description="Buscas prontas para qualificação."
          icon={CheckSquare}
        />
        <MetricCard
          title="Empresas encontradas"
          value={vm.metrics.totalDiscovered}
          description="Volume bruto captado até agora."
          icon={Radar}
        />
      </div>

      <div className="grid gap-7 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="glass-card overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Empresas locais</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crie buscas no em nossa solução e monte sua fila de abordagem comercial.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button className="gap-2" onClick={() => vm.setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nova busca
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {vm.searchesQuery.isLoading && !vm.searches.length ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Carregando buscas...
              </div>
            ) : !vm.searches.length ? (
              <EmptyState
                icon={Search}
                title="Nenhuma busca criada"
                description="Crie a primeira busca para encontrar empresas locais e começar a montar sua fila comercial."
                actionLabel="Nova busca"
                onAction={() => vm.setCreateOpen(true)}
              />
            ) : (
              vm.searches.map((search) => {
                const active = search.id === vm.selectedSearch?.id;
                return (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => vm.setSelectedSearchId(search.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${active
                      ? 'border-primary/30 bg-primary/5 shadow-sm'
                      : 'border-border/60 bg-background/70 hover:bg-muted/20'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {search.businessTypeQuery}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSearchTerritory(
                            search.city,
                            search.state,
                            search.neighborhood,
                          )}
                        </p>
                      </div>
                      <StatusBadge status={search.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                        Google Places
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                        {search.discoveredCount} encontrados
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Atualizada em {formatDateTime(search.updatedAt)}
                    </p>
                    {search.failureReason ? (
                      <p className="mt-2 text-xs text-destructive">{search.failureReason}</p>
                    ) : null}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="space-y-4">
            {vm.selectedSearch ? (
              <>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-base">
                      {vm.selectedSearch.businessTypeQuery}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatSearchTerritory(
                        vm.selectedSearch.city,
                        vm.selectedSearch.state,
                        vm.selectedSearch.neighborhood,
                      )}{' '}
                      • até {vm.selectedSearch.maxResults} resultados
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={vm.selectedSearch.status} />
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      {vm.results.length} resultados carregados
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Checkbox checked={allSelected} onCheckedChange={() => vm.toggleAllResults()} />
                    <span>{vm.selectedResultIds.length} selecionados</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={
                        !vm.results.length ||
                        vm.importMutation.isPending ||
                        vm.allResultsImported
                      }
                      onClick={vm.importSelected}
                    >
                      <Database className="h-4 w-4" />
                      {vm.importMutation.isPending
                        ? 'Importando...'
                        : vm.allResultsImported
                          ? 'Contatos importados'
                          : 'Importar no CRM'}
                    </Button>
                    <Button
                      className="gap-2"
                      disabled={!vm.results.length}
                      onClick={() => vm.openProspectDialog()}
                    >
                      <Megaphone className="h-4 w-4" />
                      Preparar abordagem
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <CardTitle className="text-base">Resultados da busca</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Selecione uma busca na coluna da esquerda para revisar as empresas encontradas.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {vm.selectedSearch ? (
              vm.resultsQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  Carregando resultados...
                </div>
              ) : !vm.results.length ? (
                <EmptyState
                  icon={Users}
                  title="Sem resultados ainda"
                  description="A busca ainda não retornou empresas ou não encontrou estabelecimentos para esse critério."
                />
              ) : (
                <div className="space-y-3">
                  {vm.paginatedResults.map((result) => {
                    const checked = vm.selectedResultIds.includes(result.id);
                    const imported = vm.importedResultIds.has(result.id);
                    return (
                      <div
                        key={result.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => vm.openResultDetails(result.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            vm.openResultDetails(result.id);
                          }
                        }}
                        className={`rounded-2xl border p-4 transition-all ${checked
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border/60 bg-background/70 hover:bg-muted/20'
                          } cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
                      >
                        <div className="flex items-start gap-3">
                          <div onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => vm.toggleResult(result.id)}
                              aria-label={`Selecionar ${result.businessName}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {result.businessName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatSearchLocation(result.city, result.state)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                  Google Places
                                </Badge>
                                {imported ? (
                                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                                    No CRM
                                  </Badge>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={checked ? 'secondary' : 'outline'}
                                  className="h-7 px-2 text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    vm.toggleResult(result.id);
                                  }}
                                >
                                  {checked ? 'Selecionado' : 'Selecionar'}
                                </Button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {result.phone ? (
                                <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                                  {formatPhone(result.phone)}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                  Sem telefone
                                </Badge>
                              )}
                              {result.whatsappPhone ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                  WhatsApp pronto
                                </Badge>
                              ) : null}
                              {result.instagramUrl ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                  Instagram pronto
                                </Badge>
                              ) : null}
                              {result.email ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                  {result.email}
                                </Badge>
                              ) : null}
                            </div>

                            {result.website ? (
                              <a
                                href={result.website}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                Abrir website
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <AppPagination
                    page={vm.resultsPage}
                    totalPages={vm.totalResultsPages}
                    totalItems={vm.results.length}
                    currentItemsCount={vm.paginatedResults.length}
                    itemLabel="empresas"
                    onPageChange={vm.setResultsPage}
                  />
                </div>
              )
            ) : (
              <EmptyState
                icon={Radar}
                title="Nenhuma busca selecionada"
                description="Escolha uma busca para revisar as empresas encontradas pelo Google."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!vm.selectedResultDetails}
        onOpenChange={(open) => {
          if (!open) {
            vm.setSelectedResultDetailsId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {vm.selectedResultDetails ? (
            <>
              <DialogHeader>
                <DialogTitle>{vm.selectedResultDetails.businessName}</DialogTitle>
                <DialogDescription>
                  {formatSearchLocation(
                    vm.selectedResultDetails.city,
                    vm.selectedResultDetails.state,
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                    Google Places
                  </Badge>
                  {vm.importedResultIds.has(vm.selectedResultDetails.id) ? (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      No CRM
                    </Badge>
                  ) : null}
                  {vm.selectedResultDetails.whatsappPhone ? (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      WhatsApp pronto
                    </Badge>
                  ) : null}
                  {vm.selectedResultDetails.instagramUrl ? (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      Instagram pronto
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Telefone
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {vm.selectedResultDetails.phone
                        ? formatPhone(vm.selectedResultDetails.phone)
                        : 'Nao informado'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      WhatsApp
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {vm.selectedResultDetails.whatsappPhone
                        ? formatPhone(vm.selectedResultDetails.whatsappPhone)
                        : 'Nao identificado'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      E-mail
                    </p>
                    <p className="mt-1 break-words text-sm font-medium text-foreground">
                      {vm.selectedResultDetails.email ?? 'Nao informado'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Website
                    </p>
                    {vm.selectedResultDetails.website ? (
                      <a
                        href={vm.selectedResultDetails.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm font-medium text-primary hover:underline"
                      >
                        {vm.selectedResultDetails.website}
                        <ExternalLink className="h-3.5 w-3.5 flex-none" />
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        Nao informado
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => vm.toggleResult(vm.selectedResultDetails!.id)}
                  >
                    {vm.selectedResultIds.includes(vm.selectedResultDetails.id)
                      ? 'Remover da selecao'
                      : 'Selecionar empresa'}
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => vm.prepareSingleResult(vm.selectedResultDetails!.id)}
                  >
                    <Megaphone className="h-4 w-4" />
                    Preparar mensagem
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
        <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Descubra novos negócios em potencial</SheetTitle>
            <SheetDescription>
              Defina o segmento e o território para encontrar empresas locais e alimentar a próxima rodada de abordagem.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="prospect-search-query">Tipo de negócio</Label>
              <Input
                id="prospect-search-query"
                value={vm.searchForm.businessTypeQuery}
                onChange={(event) =>
                  vm.updateSearchForm('businessTypeQuery', event.target.value)
                }
                placeholder="Ex: clinica odontologica, academia, imobiliaria"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-search-city">Cidade</Label>
              <Input
                id="prospect-search-city"
                value={vm.searchForm.city}
                onChange={(event) => vm.updateSearchForm('city', event.target.value)}
                placeholder="Ex: Rio de Janeiro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-search-neighborhood">Bairro</Label>
              <Input
                id="prospect-search-neighborhood"
                value={vm.searchForm.neighborhood}
                onChange={(event) =>
                  vm.updateSearchForm('neighborhood', event.target.value)
                }
                placeholder="Ex: Copacabana"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-search-state">Estado</Label>
              <Input
                id="prospect-search-state"
                value={vm.searchForm.state}
                onChange={(event) => vm.updateSearchForm('state', event.target.value)}
                placeholder="Ex: RJ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-search-max-results">Limite</Label>
              <Input
                id="prospect-search-max-results"
                type="number"
                min="1"
                max="200"
                value={vm.searchForm.maxResults}
                onChange={(event) =>
                  vm.updateSearchForm('maxResults', event.target.value)
                }
              />
            </div>
          </div>

          {vm.searchError ? (
            <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <p>{vm.searchError}</p>
              </div>
            </div>
          ) : null}

          <ProspectingSearchRadarPreview
            businessTypeQuery={vm.searchForm.businessTypeQuery}
            city={vm.searchForm.city}
            neighborhood={vm.searchForm.neighborhood}
            state={vm.searchForm.state}
            maxResults={vm.searchForm.maxResults}
          />

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => vm.setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vm.submitSearch()}
              disabled={vm.createSearchMutation.isPending}
            >
              {vm.createSearchMutation.isPending
                ? 'Iniciando busca...'
                : 'Encontrar empresas'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.prospectOpen} onOpenChange={vm.setProspectOpen}>
        <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Preparar abordagem a partir da busca</SheetTitle>
            <SheetDescription>
              Revise os contatos encontrados, ajuste a mensagem e envie a primeira conversa pelos canais já configurados.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              {vm.selectedResultIds.length} empresas selecionadas para abordagem.
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              O envio direto dispara somente a primeira empresa pronta para o canal selecionado. As demais continuam na fila para abordagem assistida.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="prospect-campaign-name">Nome da abordagem</Label>
                <Input
                  id="prospect-campaign-name"
                  value={vm.prospectForm.campaignName}
                  onChange={(event) =>
                    vm.updateProspectForm('campaignName', event.target.value)
                  }
                  placeholder="Ex: Clinica odontologica RJ abril"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Canal</Label>
                <ProspectingChannelSelector
                  mode="single"
                  value={vm.prospectForm.channel}
                  onChange={(channel) => vm.updateProspectForm('channel', channel)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="prospect-campaign-objective">Objetivo</Label>
                <Input
                  id="prospect-campaign-objective"
                  value={vm.prospectForm.objective}
                  onChange={(event) =>
                    vm.updateProspectForm('objective', event.target.value)
                  }
                  placeholder="Ex: apresentar a solução e abrir conversa com decisores"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Contexto da busca
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {vm.selectedSearch?.businessTypeQuery ?? 'Busca atual'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {vm.selectedSearch
                      ? formatSearchTerritory(
                        vm.selectedSearch.city,
                        vm.selectedSearch.state,
                        vm.selectedSearch.neighborhood,
                      )
                      : 'Território não selecionado'}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Publico selecionado
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {vm.channelReadySelectedProspects.length} empresas
                  </p>
                  <p className="text-sm text-muted-foreground">
                    A IA usa o segmento, o território e as empresas marcadas para
                    montar o texto.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-2xl border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Mostrando {vm.visibleChannelReadySelectedProspects.length} de{' '}
                  {vm.channelReadySelectedProspects.length} empresas prontas para{' '}
                  {formatChannel(vm.prospectForm.channel)}
                </span>
                {vm.selectedProspects.length > 10 ? (
                  <span>Refine a seleção na lista principal se precisar.</span>
                ) : null}
              </div>
              {vm.channelReadySelectedProspects.length !== vm.selectedProspects.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {vm.selectedProspects.length - vm.channelReadySelectedProspects.length}{' '}
                  empresas foram ocultadas porque não possuem o canal selecionado.
                </div>
              ) : null}
              {vm.visibleChannelReadySelectedProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  className="rounded-xl border border-border/60 bg-background px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {prospect.businessName}
                    </p>
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                      {formatSearchLocation(prospect.city, prospect.state)}
                    </Badge>
                    {prospect.whatsappPhone ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        WhatsApp
                      </Badge>
                    ) : null}
                    {prospect.instagramUrl ? (
                      <Badge
                        variant="secondary"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        Instagram
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {prospect.whatsappPhone
                      ? formatPhone(prospect.whatsappPhone)
                      : prospect.phone
                        ? formatPhone(prospect.phone)
                        : 'Sem telefone'}
                    {prospect.email ? ` • ${prospect.email}` : ''}
                  </p>
                </div>
              ))}
            </div>

            <ProspectingMessageSection
              id="prospect-message-template"
              description="A mensagem final sai daqui. Se quiser, a IA monta um rascunho com base no objetivo, no canal, na busca e nas empresas selecionadas."
              value={vm.prospectForm.messageTemplate}
              placeholder="A mensagem inicial da abordagem aparece aqui."
              onChange={(value) => vm.updateProspectForm('messageTemplate', value)}
              onSuggest={() => vm.suggestProspectMessage()}
              isSuggesting={vm.suggestMessageMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setProspectOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vm.dispatchSelectedProspect()}
              disabled={vm.prospectMutation.isPending || vm.dispatchProspectMutation.isPending}
            >
              {vm.dispatchProspectMutation.isPending ? 'Enviando...' : 'Enviar mensagem'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProspectingAdsInsightsContent({
  vm,
  connectionVm,
  onOpenCampaigns,
}: {
  vm: ReturnType<typeof useProspectingAdsInsightsViewModel>;
  connectionVm: ReturnType<typeof useGoogleAdsConnectionViewModel>;
  onOpenCampaigns: () => void;
}) {
  const groupedResults = useMemo(
    () => ({
      demand: vm.results.filter((item) => item.resultType === 'DEMAND_ESTIMATE'),
      interests: vm.results.filter((item) => item.resultType === 'INTEREST'),
      regions: vm.results.filter((item) => item.resultType === 'REGION'),
      themes: vm.results.filter((item) => item.resultType === 'KEYWORD_THEME'),
    }),
    [vm.results],
  );

  return (
    <>
      <GoogleAdsConnectionCard vm={connectionVm} />

      <div className="card-grid mb-6">
        <MetricCard
          title="Consultas de demanda"
          value={vm.queries.length}
          description="Historico de leituras do Google Ads."
          icon={BarChart3}
        />
        <MetricCard
          title="Demanda estimada"
          value={vm.summary.demand?.metricValue ?? 0}
          description={vm.summary.demand?.title ?? 'Sem leitura consolidada ainda.'}
          icon={TrendingUp}
        />
        <MetricCard
          title="Interesse dominante"
          value={vm.summary.topInterest?.title ?? 'Aguardando'}
          description={vm.summary.topInterest?.subtitle ?? 'Sem afinidade principal ainda.'}
          icon={Target}
        />
        <MetricCard
          title="Regiao quente"
          value={vm.summary.topRegion?.title ?? 'Aguardando'}
          description={
            vm.summary.topTheme?.title ?? 'Use esses sinais para orientar oferta e campanha.'
          }
          icon={Radar}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="glass-card overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Insights e demanda</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Entenda onde existe mais intenção comercial por segmento e regiao.
                </p>
              </div>
              <Button
                className="gap-2"
                onClick={() => vm.setCreateOpen(true)}
                disabled={!connectionVm.connection?.accountSelected}
              >
                <Plus className="h-4 w-4" />
                Nova consulta
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {vm.queriesQuery.isLoading && !vm.queries.length ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Carregando consultas...
              </div>
            ) : !vm.queries.length ? (
              <EmptyState
                icon={BarChart3}
                title="Nenhum insight gerado"
                description="Crie a primeira consulta para entender demanda, interesses e regioes com mais tração."
                actionLabel="Nova consulta"
                onAction={() => vm.setCreateOpen(true)}
              />
            ) : (
              vm.queries.map((query) => {
                const active = query.id === vm.selectedQueryId;
                return (
                  <button
                    key={query.id}
                    type="button"
                    onClick={() => vm.setSelectedQueryId(query.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${active
                      ? 'border-primary/30 bg-primary/5 shadow-sm'
                      : 'border-border/60 bg-background/70 hover:bg-muted/20'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{query.segment}</p>
                        <p className="text-xs text-muted-foreground">
                          {[query.city, query.state, query.country].filter(Boolean).join(' / ')}
                        </p>
                      </div>
                      <StatusBadge status={query.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {query.interest ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                          {query.interest}
                        </Badge>
                      ) : null}
                      {query.ageRange ? (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                          {query.ageRange}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                        {query.discoveredCount} sinais
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Atualizada em {formatDateTime(query.updatedAt)}
                    </p>
                    {query.failureReason ? (
                      <p className="mt-2 text-xs text-destructive">{query.failureReason}</p>
                    ) : null}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {vm.selectedQuery ? vm.selectedQuery.segment : 'Resultados analiticos'}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Dados agregados para orientar discurso, oferta e prioridade comercial.
                  </p>
                </div>
                <Button variant="outline" className="gap-2" onClick={onOpenCampaigns}>
                  <Megaphone className="h-4 w-4" />
                  Ir para campanhas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {vm.selectedQuery ? (
                vm.resultsQuery.isLoading ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                    Carregando insights...
                  </div>
                ) : !vm.results.length ? (
                  <EmptyState
                    icon={Target}
                    title="Sem insights detalhados"
                    description="Essa consulta ainda não retornou dados agregados do Google Ads."
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {([
                      ['Demanda estimada', vm.summary.demand],
                      ['Interesse dominante', vm.summary.topInterest],
                      ['Regiao mais quente', vm.summary.topRegion],
                      ['Tema em destaque', vm.summary.topTheme],
                    ] as const).map(([label, item]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-border/60 bg-background/70 p-4"
                      >
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-foreground">
                          {item?.title ?? 'Aguardando'}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {item?.subtitle ?? 'Sem consolidado para este corte ainda.'}
                        </p>
                        {typeof item?.metricValue === 'number' ? (
                          <p className="mt-3 text-sm font-medium text-primary">
                            {item.metricValue}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="Nenhuma consulta selecionada"
                  description="Escolha uma consulta para ver demanda, interesses, regioes e temas relacionados."
                />
              )}
            </CardContent>
          </Card>

          {vm.selectedQuery && vm.results.length ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {([
                ['Demanda e volume', groupedResults.demand],
                ['Interesses e afinidades', groupedResults.interests],
                ['Regioes quentes', groupedResults.regions],
                ['Temas e palavras-chave', groupedResults.themes],
              ] as const).map(([title, items]) => (
                <Card key={title} className="glass-card overflow-hidden">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!items.length ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum dado consolidado para este bloco.
                      </p>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-border/60 bg-background/70 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              {formatInsightType(item.resultType)}
                            </Badge>
                            {typeof item.score === 'number' ? (
                              <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                                score {item.score}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          {item.subtitle ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.subtitle}
                            </p>
                          ) : null}
                          {typeof item.metricValue === 'number' ? (
                            <p className="mt-3 text-sm font-medium text-primary">
                              Valor estimado: {item.metricValue}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
        <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Novo insight de demanda</SheetTitle>
            <SheetDescription>
              Monte um corte de audiencia para entender tração, afinidades e temas relevantes antes de criar a campanha.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ads-insight-segment">Segmento ou tema</Label>
              <Input
                id="ads-insight-segment"
                value={vm.form.segment}
                onChange={(event) => vm.updateForm('segment', event.target.value)}
                placeholder="Ex: clinicas odontologicas premium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-insight-city">Cidade</Label>
              <Input
                id="ads-insight-city"
                value={vm.form.city}
                onChange={(event) => vm.updateForm('city', event.target.value)}
                placeholder="Ex: Rio de Janeiro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-insight-state">Estado</Label>
              <Input
                id="ads-insight-state"
                value={vm.form.state}
                onChange={(event) => vm.updateForm('state', event.target.value)}
                placeholder="Ex: RJ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-insight-age">Faixa etaria</Label>
              <Input
                id="ads-insight-age"
                value={vm.form.ageRange}
                onChange={(event) => vm.updateForm('ageRange', event.target.value)}
                placeholder="Ex: 25-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-insight-gender">Genero</Label>
              <Input
                id="ads-insight-gender"
                value={vm.form.gender}
                onChange={(event) => vm.updateForm('gender', event.target.value)}
                placeholder="Ex: female"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ads-insight-interest">Interesse</Label>
              <Input
                id="ads-insight-interest"
                value={vm.form.interest}
                onChange={(event) => vm.updateForm('interest', event.target.value)}
                placeholder="Ex: ortodontia estetica, clareamento"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => vm.submit()} disabled={vm.createQueryMutation.isPending}>
              {vm.createQueryMutation.isPending ? 'Consultando...' : 'Gerar insights'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProspectingAdsLeadsContent({
  vm,
  connectionVm,
}: {
  vm: ReturnType<typeof useProspectingAdsLeadsViewModel>;
  connectionVm: ReturnType<typeof useGoogleAdsConnectionViewModel>;
}) {
  const allVisibleSelected =
    vm.leads.length > 0 &&
    vm.leads.every((lead) => vm.selectedLeadIds.includes(lead.id));

  return (
    <>
      <GoogleAdsConnectionCard vm={connectionVm} />

      <div className="card-grid mb-6">
        <MetricCard
          title="Leads captados"
          value={vm.metrics.total}
          description="Base sincronizada de formularios do Google Ads."
          icon={Users}
        />
        <MetricCard
          title="Importados"
          value={vm.metrics.imported}
          description="Leads já reconciliados com o CRM."
          icon={Database}
        />
        <MetricCard
          title="WhatsApp pronto"
          value={vm.metrics.whatsappReady}
          description="Leads aptos para campanhas no WhatsApp."
          icon={MessageCircle}
        />
        <MetricCard
          title="Selecionados"
          value={vm.selectedLeadIds.length}
          description="Leads marcados para importação ou campanha."
          icon={CheckSquare}
        />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Leads captados</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Trabalhe apenas leads consentidos, com filtro por campanha, período e canal disponível.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => vm.syncMutation.mutate()}
                disabled={vm.syncMutation.isPending || !connectionVm.connection?.accountSelected}
              >
                <RefreshCw className="h-4 w-4" />
                {vm.syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar leads'}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => vm.importSelected()}
                disabled={!vm.selectedLeadIds.length || vm.importMutation.isPending}
              >
                <Database className="h-4 w-4" />
                {vm.importMutation.isPending ? 'Importando...' : 'Importar no CRM'}
              </Button>
              <Button
                className="gap-2"
                onClick={() => vm.openProspectDialog()}
                disabled={!vm.selectedLeadIds.length}
              >
                <Megaphone className="h-4 w-4" />
                Criar campanha
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="ads-leads-campaign">Campanha</Label>
              <Input
                id="ads-leads-campaign"
                value={vm.filters.campaignName}
                onChange={(event) => vm.updateFilters('campaignName', event.target.value)}
                placeholder="Filtrar por nome da campanha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-leads-status">Status CRM</Label>
              <Select
                value={vm.filters.importStatus}
                onValueChange={(value) => vm.updateFilters('importStatus', value)}
              >
                <SelectTrigger id="ads-leads-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="NEW">Novos</SelectItem>
                  <SelectItem value="IMPORTED">Importados</SelectItem>
                  <SelectItem value="REUSED">Reaproveitados</SelectItem>
                  <SelectItem value="SKIPPED_NO_PHONE">Sem canal válido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-leads-channel">Canal</Label>
              <Select
                value={vm.filters.channel}
                onValueChange={(value) =>
                  vm.updateFilters('channel', value as 'WHATSAPP' | 'INSTAGRAM')
                }
              >
                <SelectTrigger id="ads-leads-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-leads-date-from">De</Label>
              <Input
                id="ads-leads-date-from"
                type="date"
                value={vm.filters.dateFrom}
                onChange={(event) => vm.updateFilters('dateFrom', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads-leads-date-to">Até</Label>
              <Input
                id="ads-leads-date-to"
                type="date"
                value={vm.filters.dateTo}
                onChange={(event) => vm.updateFilters('dateTo', event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {vm.leadsQuery.isLoading && !vm.leads.length ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              Carregando leads...
            </div>
          ) : !vm.leads.length ? (
            <EmptyState
              icon={Users}
              title="Nenhum lead captado"
              description="Sincronize os formularios do Google Ads para trazer leads consentidos para essa fila."
              actionLabel="Sincronizar leads"
              onAction={() => vm.syncMutation.mutate()}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Checkbox checked={allVisibleSelected} onCheckedChange={() => vm.toggleAllVisible()} />
                <span>{vm.selectedLeadIds.length} selecionados nesta operação</span>
              </div>

              {vm.leads.map((lead) => {
                const checked = vm.selectedLeadIds.includes(lead.id);
                return (
                  <div
                    key={lead.id}
                    className={`rounded-2xl border p-4 transition-all ${checked
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/60 bg-background/70'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={checked} onCheckedChange={() => vm.toggleLead(lead.id)} />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {lead.fullName || 'Lead Google Ads'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[lead.city, lead.state].filter(Boolean).join(' / ') || 'Sem localidade'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              {lead.campaignName || 'Sem campanha'}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                              {formatLeadImportStatus(lead.importStatus)}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {lead.phone ? (
                            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                              {formatPhone(lead.phone)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              Sem telefone
                            </Badge>
                          )}
                          {lead.instagramHandle ? (
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              @{lead.instagramHandle}
                            </Badge>
                          ) : null}
                          {lead.email ? (
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              {lead.email}
                            </Badge>
                          ) : null}
                          {lead.formName ? (
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              {lead.formName}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Enviado em {formatDateTime(lead.submissionAt)}
                          </p>
                          {lead.contactId ? (
                            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                              Vinculado ao CRM
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <AppPagination
                page={vm.pagination.page}
                totalPages={vm.pagination.totalPages}
                totalItems={vm.pagination.total}
                currentItemsCount={vm.leads.length}
                itemLabel="leads"
                onPageChange={vm.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={vm.prospectOpen} onOpenChange={vm.setProspectOpen}>
        <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Criar campanha com leads captados</SheetTitle>
            <SheetDescription>
              Esses leads já vieram por formulário do Google Ads e podem seguir direto para CRM e campanha.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              {vm.selectedLeadIds.length} leads selecionados para a campanha.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ads-leads-campaign-name">Nome da campanha</Label>
                <Input
                  id="ads-leads-campaign-name"
                  value={vm.form.campaignName}
                  onChange={(event) => vm.updateForm('campaignName', event.target.value)}
                  placeholder="Ex: Leads Google Ads abril"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Canal</Label>
                <ProspectingChannelSelector
                  mode="single"
                  value={vm.form.channel}
                  onChange={(channel) => vm.updateForm('channel', channel)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ads-leads-objective">Objetivo</Label>
                <Input
                  id="ads-leads-objective"
                  value={vm.form.objective}
                  onChange={(event) => vm.updateForm('objective', event.target.value)}
                  placeholder="Ex: iniciar conversa com leads quentes e agendar atendimento"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Publico selecionado
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {vm.selectedLeads.length} leads
                  </p>
                  <p className="text-sm text-muted-foreground">
                    O texto da IA considera a campanha de origem e os dados captados.
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="space-y-2 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Origem dominante
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {vm.selectedLeads[0]?.campaignName || 'Google Ads'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Use esse contexto para personalizar oferta, timing e CTA.
                  </p>
                </CardContent>
              </Card>
            </div>

            <ProspectingMessageSection
              id="ads-leads-message"
              description="A IA usa campanha, objetivo e leads selecionados para gerar uma abordagem inicial mais alinhada."
              value={vm.form.messageTemplate}
              placeholder="A mensagem da campanha aparece aqui."
              onChange={(value) => vm.updateForm('messageTemplate', value)}
              onSuggest={() => vm.suggestMessage()}
              isSuggesting={vm.suggestMessageMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setProspectOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => vm.submitProspect()} disabled={vm.prospectMutation.isPending}>
              {vm.prospectMutation.isPending ? 'Criando campanha...' : 'Criar campanha'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProspectingCampaignsContent({
  vm,
}: {
  vm: ReturnType<typeof useProspectingCampaignsViewModel>;
}) {
  return (
    <>
      <div className="card-grid mb-6">
        <MetricCard
          title="Campanhas"
          value={vm.metrics.totalCampaigns}
          description="Campanhas salvas para operação."
          icon={Megaphone}
        />
        <MetricCard
          title="Ativas"
          value={vm.metrics.activeCampaigns}
          description="Prontas para rodar disparos."
          icon={Play}
        />
        <MetricCard
          title="Rascunhos"
          value={vm.metrics.draftCampaigns}
          description="Modelos aguardando ativação."
          icon={MessageCircle}
        />
        <MetricCard
          title="Publico total"
          value={vm.metrics.totalAudience}
          description="Contatos alocados nas campanhas."
          icon={Users}
        />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Campanhas de prospecção</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Monte campanhas manuais por lista, ative disparos e acompanhe a operação comercial.
              </p>
            </div>
            <Button className="gap-2" onClick={() => vm.setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova campanha
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vm.campaignsQuery.isLoading && !vm.campaigns.length ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              Carregando campanhas...
            </div>
          ) : !vm.campaigns.length ? (
            <EmptyState
              icon={Megaphone}
              title="Nenhuma campanha criada"
              description="Crie a primeira campanha manual ou a partir de uma busca para iniciar os disparos."
              actionLabel="Nova campanha"
              onAction={() => vm.setCreateOpen(true)}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {vm.campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-2xl border border-border/60 bg-background/70 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">{campaign.objective}</p>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                      {formatAudienceType(campaign.audienceType)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                      {formatChannel(campaign.channel)}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      {campaign.targetContactIds.length} contatos
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      limite diario {campaign.dailyLimit}
                    </Badge>
                  </div>

                  {campaign.messageTemplate ? (
                    <div className="mt-4 rounded-2xl border border-border/60 bg-muted/15 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Mensagem base
                      </p>
                      <p className="mt-2 text-sm text-foreground">{campaign.messageTemplate}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Criada em {formatDateTime(campaign.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {campaign.status === 'DRAFT' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => vm.activateCampaign(campaign.id)}
                          disabled={vm.activateCampaignMutation.isPending}
                        >
                          <Play className="h-4 w-4" />
                          Ativar
                        </Button>
                      ) : null}
                      {campaign.status === 'ACTIVE' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => vm.pauseCampaign(campaign.id)}
                          disabled={vm.pauseCampaignMutation.isPending}
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </Button>
                      ) : null}
                      {(campaign.status === 'ACTIVE' || campaign.status === 'DRAFT') ? (
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => vm.startCampaign(campaign.id)}
                          disabled={vm.startCampaignMutation.isPending}
                        >
                          <Megaphone className="h-4 w-4" />
                          Iniciar disparos
                        </Button>
                      ) : null}
                      {campaign.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-2"
                          onClick={() => vm.dispatchNextCampaign(campaign.id)}
                          disabled={vm.dispatchNextCampaignMutation.isPending}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar próxima
                        </Button>
                      ) : null}
                      {vm.lastDispatchedConversationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() =>
                            vm.navigateToConversation(vm.lastDispatchedConversationId!)
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver conversa
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {campaign.channel === 'WHATSAPP' ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Guardrail ativo: o envio comercial sai manualmente, uma conversa por vez, com mensagem personalizada.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={vm.createOpen} onOpenChange={vm.setCreateOpen}>
        <SheetContent side="right" className="w-[860px] sm:max-w-[860px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova campanha manual</SheetTitle>
            <SheetDescription>
              Monte uma campanha com publico do CRM e defina o texto inicial do canal escolhido.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nome</Label>
              <Input
                id="campaign-name"
                value={vm.campaignForm.name}
                onChange={(event) => vm.updateCampaignForm('name', event.target.value)}
                placeholder="Ex: Oferta abril - base premium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-daily-limit">Limite diario</Label>
              <Input
                id="campaign-daily-limit"
                type="number"
                min="1"
                max="500"
                value={vm.campaignForm.dailyLimit}
                onChange={(event) => vm.updateCampaignForm('dailyLimit', event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="campaign-objective">Objetivo</Label>
              <Input
                id="campaign-objective"
                value={vm.campaignForm.objective}
                onChange={(event) => vm.updateCampaignForm('objective', event.target.value)}
                placeholder="Ex: gerar reunioes com empresas do segmento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-audience-type">Publico</Label>
              <Select
                value={vm.campaignForm.audienceType}
                onValueChange={(value) =>
                  vm.updateCampaignForm('audienceType', value as 'REENGAGEMENT' | 'CONTACT_LIST')
                }
              >
                <SelectTrigger id="campaign-audience-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTACT_LIST">Lista de contatos</SelectItem>
                  <SelectItem value="REENGAGEMENT">Reengajamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Canais</Label>
              <ProspectingChannelSelector
                mode="multiple"
                value={vm.campaignForm.channels}
                onChange={(channel) => vm.toggleChannel(channel)}
              />
            </div>
            {vm.campaignForm.audienceType === 'CONTACT_LIST' ? (
              <div className="space-y-3 md:col-span-2">
                <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-contact-search">Contatos do CRM</Label>
                    <Input
                      id="campaign-contact-search"
                      value={vm.contactSearch}
                      onChange={(event) => vm.setContactSearch(event.target.value)}
                      placeholder="Buscar por nome, telefone ou email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-contact-stage">Status do CRM</Label>
                    <Select
                      value={vm.stageFilter}
                      onValueChange={(value) => vm.setStageFilter(value as 'ALL' | ContactStage)}
                    >
                      <SelectTrigger id="campaign-contact-stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_STAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => vm.toggleAllVisibleContacts()}
                      disabled={!vm.visibleContacts.length}
                    >
                      Selecionar visiveis
                    </Button>
                  </div>
                </div>

                <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-2xl border border-border/60 bg-muted/10 p-3">
                  {vm.contactsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando contatos...</p>
                  ) : !vm.filteredContacts.length ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum contato encontrado para este filtro.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          Mostrando {vm.visibleContacts.length} de {vm.filteredContacts.length} contatos filtrados
                        </span>
                        {vm.filteredContacts.length > 10 ? (
                          <span>Refine a busca para encontrar mais rapido.</span>
                        ) : null}
                      </div>
                      {vm.visibleContacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 transition-colors hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={vm.campaignForm.targetContactIds.includes(contact.id)}
                            onCheckedChange={() => vm.toggleTargetContact(contact.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{contact.name}</p>
                              <StatusBadge status={contact.stage} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatPhone(contact.phone)}
                              {contact.email ? ` â€¢ ${contact.email}` : ''}
                            </p>
                          </div>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <ProspectingMessageSection
                id="campaign-message-template"
                description="A mensagem final sai daqui. Use {{first_name}} ou {{name}} para personalizar cada envio e manter o disparo individualizado."
                value={vm.campaignForm.messageTemplate}
                placeholder="A mensagem inicial da campanha aparece aqui."
                onChange={(value) => vm.updateCampaignForm('messageTemplate', value)}
                onSuggest={() => vm.suggestMessage()}
                isSuggesting={vm.suggestMessageMutation.isPending}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => vm.setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => vm.submitCreateCampaign()}
              disabled={vm.createCampaignMutation.isPending}
            >
              {vm.createCampaignMutation.isPending ? 'Criando campanha...' : 'Criar campanha'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ProspectingSearchesPage() {
  const placesVm = useProspectingSearchesViewModel();

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Prospecção local</h1>
          <p className="page-description">
            Encontre empresas, selecione quem faz sentido e inicie a
            abordagem comercial sem depender de integrações extras.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleAgentRuleButton moduleId="prospecting" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => placesVm.setReportsOpen(true)}
          >
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Button>
        </div>
      </div>

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={placesVm.activeJobItems}
      />

      <ProspectingPlacesContent vm={placesVm} />
      <ProspectingSearchReportsSheet vm={placesVm} />
    </div>
  );
}

export function ProspectingCampaignsPage() {
  const vm = useProspectingCampaignsViewModel();

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Campanhas de prospecção</h1>
          <p className="page-description">
            Gerencie campanhas manuais e acompanhe a operação comercial por canal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleAgentRuleButton
            moduleId="prospecting"
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => vm.setReportsOpen(true)}>
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Button>
        </div>
      </div>

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.activeJobItems}
      />

      <ProspectingCampaignsContent vm={vm} />
      <ProspectingCampaignReportsSheet vm={vm} />
    </div>
  );
}
