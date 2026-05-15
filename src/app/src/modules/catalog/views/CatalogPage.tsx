import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Download, Filter, Layers, Package, ShieldCheck } from 'lucide-react';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { useCatalogPageViewModel } from '@/modules/catalog/view-models/useCatalogPageViewModel';
import { CatalogHeader } from '../components/CatalogHeader';
import { CatalogKPIs } from '../components/CatalogKPIs';
import { CatalogItemsTab } from '../components/CatalogItemsTab';
import { CatalogCategoriesTab } from '../components/CatalogCategoriesTab';
import { CatalogReadinessTab } from '../components/CatalogReadinessTab';
import { CatalogCategorySheet } from '../components/CatalogCategorySheet';
import { CatalogItemSheet } from '../components/CatalogItemSheet';
import { CatalogItemDetailsSheet } from '../components/CatalogItemDetailsSheet';
import { CatalogImportSheet } from '../components/CatalogImportSheet';
import { CatalogReportsSheet } from '../components/CatalogReportsSheet';

export default function CatalogPage() {
  const vm = useCatalogPageViewModel();

  const items = vm.filteredItems;
  const categories = vm.categoriesQuery.data ?? [];
  const allItems = vm.itemsQuery.data ?? [];
  const activeItemsCount = allItems.filter((item) => item.active).length;
  const servicesCount = allItems.filter((item) => item.type === 'SERVICE').length;
  const productsCount = allItems.filter((item) => item.type === 'PRODUCT').length;

  return (
    <div className="page-container animate-fade-in">
      <CatalogHeader
        onOpenImport={() => vm.setImportOpen(true)}
        onNewCategory={() => vm.setCreateCategoryOpen(true)}
        onNewItem={() => vm.setCreateItemOpen(true)}
      />

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.activeJobItems}
      />

      <Card className="glass-card border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório do catalogo</p>
              <p className="text-xs text-muted-foreground">
                A lista e o CSV usam busca, tipo e status ativo/inativo selecionados.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-4 rounded-xl border border-border/60 bg-background/60 p-1">
              {[
                { value: 'ALL', label: 'Todos' },
                { value: 'PRODUCT', label: 'Produtos' },
                { value: 'SERVICE', label: 'Serviços' },
                { value: 'RENTAL', label: 'Locações' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.typeFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => vm.setTypeFilter(option.value as typeof vm.typeFilter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={() => vm.setReportsOpen(true)}
            >
              <Download className="h-4 w-4" />
              Relatórios
            </Button>
          </div>
        </CardContent>
      </Card>

      <CatalogKPIs
        activeItemsCount={activeItemsCount}
        categoriesCount={categories.length}
        servicesCount={servicesCount}
        productsCount={productsCount}
      />

      <Tabs defaultValue="items" className="space-y-5">
        <PageTabsList
          tabs={[
            { value: 'items', label: 'Itens', icon: Package },
            { value: 'categories', label: 'Categorias', icon: Layers },
            { value: 'readiness', label: 'Prontidão', icon: ShieldCheck },
          ]}
        />

        <TabsContent value="items">
          <CatalogItemsTab
            items={items}
            isLoading={vm.itemsQuery.isLoading}
            search={vm.search}
            onSearchChange={vm.setSearch}
            typeFilter={vm.typeFilter}
            onTypeFilterChange={vm.setTypeFilter}
            showInactive={vm.showInactive}
            onShowInactiveChange={vm.setShowInactive}
            onSelectItem={vm.setSelectedItem}
            onNewItem={() => vm.setCreateItemOpen(true)}
            page={vm.page}
            totalPages={vm.totalPages}
            totalItems={vm.totalFilteredItems}
            onPageChange={vm.setPage}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CatalogCategoriesTab
            categories={categories}
            items={allItems}
            isLoading={vm.categoriesQuery.isLoading}
            onNewCategory={() => vm.setCreateCategoryOpen(true)}
            onEditCategory={vm.openEditCategory}
            onDeleteCategory={vm.setDeleteCategoryTarget}
          />
        </TabsContent>

        <TabsContent value="readiness">
          <CatalogReadinessTab />
        </TabsContent>
      </Tabs>

      <CatalogCategorySheet
        open={vm.createCategoryOpen}
        onOpenChange={vm.setCreateCategoryOpen}
        isEditing={vm.isEditingCategory}
        currentCategoryId={vm.selectedCategory?.id}
        categories={categories}
        form={vm.categoryForm}
        onFormChange={(data) => vm.setCategoryForm(data)}
        onSubmit={() =>
          vm.isEditingCategory
            ? vm.updateCategoryMutation.mutate()
            : vm.createCategoryMutation.mutate()
        }
        isPending={vm.createCategoryMutation.isPending || vm.updateCategoryMutation.isPending}
      />

      <CatalogItemSheet
        open={vm.createItemOpen}
        onOpenChange={vm.setCreateItemOpen}
        isEditing={vm.isEditingItem}
        categories={categories}
        form={vm.itemForm}
        onFormChange={(data) => vm.setItemForm(data)}
        onPriceChange={vm.setItemBasePrice}
        onUploadImage={vm.uploadItemImageMutation.mutate}
        onNewCategory={() => vm.setCreateCategoryOpen(true)}
        isUploading={vm.uploadItemImageMutation.isPending}
        linkedInventoryItems={vm.linkedInventoryItems}
        onSubmit={() =>
          vm.isEditingItem
            ? vm.updateItemMutation.mutate()
            : vm.createItemMutation.mutate()
        }
        isPending={vm.createItemMutation.isPending || vm.updateItemMutation.isPending}
      />

      <CatalogItemDetailsSheet
        item={vm.selectedItem}
        onOpenChange={(open) => !open && vm.setSelectedItem(null)}
        onEdit={vm.openEditItem}
        onDelete={vm.setDeleteItemTarget}
        isDeleting={vm.deleteItemMutation.isPending}
      />

      <CatalogImportSheet
        open={vm.importOpen}
        onOpenChange={vm.setImportOpen}
        form={vm.importForm}
        categories={categories}
        previewCount={vm.importPreviewCount}
        activeJob={vm.activeImportJob}
        isPending={vm.importItemsMutation.isPending}
        onFormChange={(field, value) =>
          vm.setImportForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={() => vm.importItemsMutation.mutate()}
      />

      <CatalogReportsSheet vm={vm} />

      <AlertDialog
        open={Boolean(vm.deleteCategoryTarget)}
        onOpenChange={(open) => !open && vm.setDeleteCategoryTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria saira da operação ativa. Se houver itens ativos vinculados, a remoção sera bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => vm.deleteCategoryTarget && vm.deleteCategoryMutation.mutate(vm.deleteCategoryTarget.id)}
            >
              Remover categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(vm.deleteItemTarget)}
        onOpenChange={(open) => !open && vm.setDeleteItemTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              O item sera retirado do catalogo ativo e deixara de aparecer para a operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => vm.deleteItemTarget && vm.deleteItemMutation.mutate(vm.deleteItemTarget.id!)}
            >
              Remover item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
