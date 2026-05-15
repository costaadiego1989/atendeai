import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Filter, Search, Plus, Pencil, Trash2, CalendarDays, Percent, Tag, TrendingDown, ShoppingCart } from 'lucide-react';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { formatDate } from '@/shared/lib/formatters';
import { usePromotionsViewModel } from '../view-models/usePromotionsViewModel';
import { SalesMetricCard } from '../components/SalesMetricCard';
import { TargetSearchList } from '../components/TargetSearchList';

export function PromotionsTab() {
  const vm = usePromotionsViewModel();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold tracking-tight">Todas as Campanhas</h2>
        <Button onClick={vm.openCreateSheet}>
          <Plus className="mr-2 h-4 w-4" /> Nova Promoção
        </Button>
      </div>

      <div className="card-grid mb-6">
        <SalesMetricCard
          icon={Tag}
          title="Em Circulação"
          value={vm.stats.active}
          subtitle="Campanhas ativas divulgadas"
        />
        <SalesMetricCard
          icon={Percent}
          title="Desconto Médio (%)"
          value={`${vm.stats.avgDiscountPct}%`}
          subtitle="Atratividade orgânica média"
        />
        <SalesMetricCard
          icon={TrendingDown}
          title="Maior Abatimento"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vm.stats.maxDiscountFixed)}
          subtitle="Maior oferta nominal ativa"
        />
        <SalesMetricCard
          icon={ShoppingCart}
          title="Upsell Integrado"
          value={vm.stats.withCondition}
          subtitle="Com limite de pedido mínimo"
        />
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar campanhas..."
              className="pl-9"
              value={vm.search}
              onChange={(e) => vm.setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={vm.statusFilter} onValueChange={(v: any) => vm.setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativas</SelectItem>
                <SelectItem value="EXPIRED">Expiradas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!vm.search && vm.statusFilter === 'ALL'}
              onClick={() => { vm.setSearch(''); vm.setStatusFilter('ALL'); }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>

      {vm.query.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : vm.promotions.length === 0 ? (
        <Card className="glass-card flex flex-col items-center py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-bold">Nenhuma promoção encontrada.</p>
          <p className="text-sm text-muted-foreground mt-1">Crie a primeira campanha para gerir seus descontos ativamente.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {vm.promotions.map((promo) => (
            <Card key={promo.id} className="glass-card">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-foreground">{promo.title}</span>
                    <StatusBadge status={promo.active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl truncate">{promo.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vm.describeTargets(promo.targets, promo.catalogItemId).map((label) => (
                      <Badge key={label} variant="outline" className="max-w-[220px] truncate rounded-md">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6 px-4">
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Desconto</p>
                    <p className="font-semibold">{promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}%` : `R$ ${promo.discountValue}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Validade</p>
                    <p className="font-semibold text-sm">{promo.expiresAt ? formatDate(promo.expiresAt) : 'Sem expiração'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-4 border-l border-border/50">
                  <Button variant="ghost" size="icon" onClick={() => vm.openEditSheet(promo.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => vm.deleteMutation.mutate(promo.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={vm.sheetOpen} onOpenChange={vm.setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{vm.editingPromotionId ? 'Editar Promoção' : 'Criar Promoção'}</SheetTitle>
            <SheetDescription>Determine o título, valor de desconto e o tempo de validade da campanha promocional.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome da Campanha</Label>
              <Input value={vm.promotionForm.title} onChange={e => vm.setPromotionForm(s => ({ ...s, title: e.target.value }))} placeholder="Ex: Black Friday" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select value={vm.promotionForm.type} onValueChange={v => vm.setPromotionForm(s => ({ ...s, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={vm.promotionForm.discount} onChange={e => vm.setPromotionForm(s => ({ ...s, discount: e.target.value }))} placeholder="10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={vm.promotionForm.startsAt} onChange={e => vm.setPromotionForm(s => ({ ...s, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expiração (Opcional)</Label>
                <Input type="date" value={vm.promotionForm.expiresAt} onChange={e => vm.setPromotionForm(s => ({ ...s, expiresAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição / Regras</Label>
              <Textarea value={vm.promotionForm.description} onChange={e => vm.setPromotionForm(s => ({ ...s, description: e.target.value }))} placeholder="Insira o regulamento interno ou descrição..." rows={4} />
            </div>
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
              <TargetSearchList
                title="Itens da promoção"
                emptyMessage="Nenhum item ativo no catálogo."
                options={vm.itemOptions}
                selectedIds={vm.promotionForm.itemTargetIds}
                onChange={(itemTargetIds) =>
                  vm.setPromotionForm((state) => ({ ...state, itemTargetIds }))
                }
              />
              <TargetSearchList
                title="Categorias da promoção"
                emptyMessage="Nenhuma categoria ativa no catálogo."
                options={vm.categoryOptions}
                selectedIds={vm.promotionForm.categoryTargetIds}
                onChange={(categoryTargetIds) =>
                  vm.setPromotionForm((state) => ({ ...state, categoryTargetIds }))
                }
              />
              <p className="text-xs text-muted-foreground">Sem seleção, a promoção vale para todos os itens.</p>
            </div>
            <div className="hidden space-y-3 rounded-md border border-border/60 p-3">
              <div>
                <Label>Itens da promoÃ§Ã£o</Label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {vm.itemOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item ativo no catÃ¡logo.</p>
                  ) : vm.itemOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={vm.promotionForm.itemTargetIds.includes(option.value)}
                        onCheckedChange={(checked) => vm.setPromotionForm((state) => ({
                          ...state,
                          itemTargetIds: checked
                            ? [...state.itemTargetIds, option.value]
                            : state.itemTargetIds.filter((id) => id !== option.value),
                        }))}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Categorias da promoÃ§Ã£o</Label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {vm.categoryOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria ativa no catÃ¡logo.</p>
                  ) : vm.categoryOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={vm.promotionForm.categoryTargetIds.includes(option.value)}
                        onCheckedChange={(checked) => vm.setPromotionForm((state) => ({
                          ...state,
                          categoryTargetIds: checked
                            ? [...state.categoryTargetIds, option.value]
                            : state.categoryTargetIds.filter((id) => id !== option.value),
                        }))}
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Sem seleÃ§Ã£o, a promoÃ§Ã£o vale para todos os itens.</p>
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => vm.setSheetOpen(false)}>Cancelar</Button>
              <Button onClick={vm.savePromotion} disabled={vm.isSaving || !vm.promotionForm.title || !vm.promotionForm.discount}>
                {vm.isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
