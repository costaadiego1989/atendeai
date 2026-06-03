import { FolderKanban, PencilLine, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';

interface CatalogCategoriesTabProps {
  categories: any[];
  items: any[];
  isLoading: boolean;
  onNewCategory: () => void;
  onEditCategory: (category: any) => void;
  onDeleteCategory: (category: any) => void;
}

export function CatalogCategoriesTab({
  categories,
  items,
  isLoading,
  onNewCategory,
  onEditCategory,
  onDeleteCategory,
}: CatalogCategoriesTabProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="bg-card border border-border/60">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-8 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Nenhuma categoria cadastrada"
        description="Crie categorias para organizar melhor produtos e serviços."
        actionLabel="Nova categoria"
        onAction={onNewCategory}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {categories.map((category) => {
        const itemsCount = items.filter((item) => item.categoryId === category.id).length;
        return (
          <Card key={category.id} className="bg-card border border-border/60">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{category.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {category.description || 'Sem descrição operacional'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={category.active ? 'ACTIVE' : 'CLOSED'} />
                  <Button size="icon" variant="ghost" onClick={() => onEditCategory(category)}>
                    <PencilLine className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDeleteCategory(category)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Itens vinculados</span>
                <span className="font-semibold text-foreground">{itemsCount}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
