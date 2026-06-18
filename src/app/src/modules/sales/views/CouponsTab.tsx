import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Pencil, Trash2, TicketPercent, TicketCheck, Percent, ShoppingBag, HandCoins } from 'lucide-react';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { formatDate } from '@/shared/lib/formatters';
import { useCouponsViewModel } from '../view-models/useCouponsViewModel';
import { SalesMetricCard } from '../components/SalesMetricCard';
import { TargetSearchList } from '../components/TargetSearchList';

export function CouponsTab() {
  const vm = useCouponsViewModel();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold tracking-tight">Todos os Cupons</h2>
        <Button onClick={vm.openCreateSheet}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cupom
        </Button>
      </div>

      <div className="card-grid mb-6">
        <SalesMetricCard
          icon={TicketCheck}
          title="Ativos"
          value={vm.stats.active}
          subtitle="Disponíveis p/ uso"
        />
        <SalesMetricCard
          icon={Percent}
          title="Desconto Médio (%)"
          value={`${vm.stats.avgDiscountPct}%`}
          subtitle="Tamanho do incentivo atual"
        />
        <SalesMetricCard
          icon={ShoppingBag}
          title="Volume de Vendas"
          value={vm.stats.totalUsages}
          subtitle="Resgates totais computados"
        />
        <SalesMetricCard
          icon={HandCoins}
          title="Economia Gerada"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vm.stats.estimatedSavings)}
          subtitle="Em cupons de valor fixo"
        />
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
              <span className="font-bold text-foreground mr-1.5">{vm.coupons.length}</span>
              <span className="font-normal text-muted-foreground">{vm.coupons.length === 1 ? 'cupom' : 'cupons'}</span>
            </Badge>
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código..."
                className="pl-9 uppercase placeholder:normal-case"
                value={vm.search}
                onChange={(e) => vm.setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={vm.statusFilter} onValueChange={(v: any) => vm.setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="EXPIRED">Expirados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {vm.query.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : vm.coupons.length === 0 ? (
        <Card className="glass-card flex flex-col items-center py-16 text-center">
          <TicketPercent className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-bold">Nenhum cupom gerado.</p>
          <p className="text-sm text-muted-foreground mt-1">Crie os primeiros cupons de desconto para impulsionar suas vendas no checkout.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {vm.coupons.map((coupon) => (
            <Card key={coupon.id} className="glass-card">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded border border-primary/20 font-mono tracking-widest font-bold">
                      {coupon.code}
                    </div>
                    <StatusBadge status={coupon.active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate max-w-xl mt-2">{coupon.description || 'Sem descrição'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vm.describeTargets(coupon.targets, coupon.catalogItemId).map((label) => (
                      <Badge key={label} variant="outline" className="max-w-[220px] truncate rounded-md">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-6 px-4">
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Usos</p>
                    <div className="flex items-center justify-end gap-1 font-semibold text-sm">
                      {coupon.usedCount} de {coupon.maxUses === 0 ? '∞' : coupon.maxUses}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Desconto</p>
                    <p className="font-semibold">{coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `R$ ${coupon.discountValue}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground tracking-widest font-bold">Expira em</p>
                    <p className="font-semibold text-sm">{coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Nunca'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-4 border-l border-border/50">
                  <Button aria-label="Editar cupom" variant="ghost" size="icon" onClick={() => vm.openEditSheet(coupon.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button aria-label="Excluir cupom" variant="ghost" size="icon" onClick={() => vm.deleteMutation.mutate(coupon.id)} className="text-muted-foreground hover:text-destructive">
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
            <SheetTitle>{vm.editingCouponId ? 'Editar Cupom' : 'Criar Cupom'}</SheetTitle>
            <SheetDescription>Configure o código alfa-numérico e as regras de resgate.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Código do Cupom</Label>
              <Input 
                value={vm.form.code} 
                onChange={e => vm.setForm(s => ({ ...s, code: e.target.value.toUpperCase() }))} 
                placeholder="Ex: OFERTA10" 
                className="font-mono uppercase font-bold tracking-widest"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select value={vm.form.type} onValueChange={v => vm.setForm(s => ({ ...s, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={vm.form.discount} onChange={e => vm.setForm(s => ({ ...s, discount: e.target.value }))} placeholder="10" />
              </div>
            </div>

            <div className="border border-border/60 rounded-xl p-4 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Uso ilimitado</Label>
                  <p className="text-xs text-muted-foreground mt-1">Qualquer quantidade de clientes pode usar.</p>
                </div>
                <Switch checked={vm.form.isUnlimited} onCheckedChange={(v) => vm.setForm((s) => ({ ...s, isUnlimited: v }))} />
              </div>
              {!vm.form.isUnlimited && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label>Limite de Resgates Máximo</Label>
                  <Input type="number" min="1" value={vm.form.maxUses} onChange={e => vm.setForm(s => ({ ...s, maxUses: e.target.value }))} placeholder="Ex: 50 cupons totais" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input type="date" value={vm.form.startsAt} onChange={e => vm.setForm(s => ({ ...s, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expiração (Opcional)</Label>
                <Input type="date" value={vm.form.expiresAt} onChange={e => vm.setForm(s => ({ ...s, expiresAt: e.target.value }))} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={vm.form.description} onChange={e => vm.setForm(s => ({ ...s, description: e.target.value }))} placeholder="Descrição opcional do cupom..." rows={3} />
            </div>
            
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
              <TargetSearchList
                title="Itens do cupom"
                emptyMessage="Nenhum item ativo no catálogo."
                options={vm.itemOptions}
                selectedIds={vm.form.itemTargetIds}
                onChange={(itemTargetIds) =>
                  vm.setForm((state) => ({ ...state, itemTargetIds }))
                }
              />
              <TargetSearchList
                title="Categorias do cupom"
                emptyMessage="Nenhuma categoria ativa no catálogo."
                options={vm.categoryOptions}
                selectedIds={vm.form.categoryTargetIds}
                onChange={(categoryTargetIds) =>
                  vm.setForm((state) => ({ ...state, categoryTargetIds }))
                }
              />
              <p className="text-xs text-muted-foreground">Sem seleção, o cupom vale para todos os itens.</p>
            </div>
            <div className="hidden space-y-3 rounded-md border border-border/60 p-3">
              <div>
                <Label>Itens do cupom</Label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {vm.itemOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item ativo no catÃ¡logo.</p>
                  ) : vm.itemOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={vm.form.itemTargetIds.includes(option.value)}
                        onCheckedChange={(checked) => vm.setForm((state) => ({
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
                <Label>Categorias do cupom</Label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {vm.categoryOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria ativa no catÃ¡logo.</p>
                  ) : vm.categoryOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={vm.form.categoryTargetIds.includes(option.value)}
                        onCheckedChange={(checked) => vm.setForm((state) => ({
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
              <p className="text-xs text-muted-foreground">Sem seleÃ§Ã£o, o cupom vale para todos os itens.</p>
            </div>
            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => vm.setSheetOpen(false)}>Cancelar</Button>
              <Button onClick={vm.saveCoupon} disabled={vm.isSaving || !vm.form.code || !vm.form.discount || (!vm.form.isUnlimited && (!vm.form.maxUses || Number(vm.form.maxUses) <= 0))}>
                {vm.isSaving ? 'Salvando...' : 'Salvar Cupom'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
