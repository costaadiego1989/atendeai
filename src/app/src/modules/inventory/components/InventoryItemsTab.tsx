import { Search, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { AppPagination } from '@/shared/ui/AppPagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatSource } from '../utils/inventory-helpers';
import type { InventoryItemRecord } from '@/shared/types';

interface InventoryItemsTabProps {
  items: InventoryItemRecord[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: 'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED') => void;
  showAvailableOnly: boolean;
  onToggleAvailableOnly: () => void;
  onSelectItem: (item: InventoryItemRecord) => void;
  onNewSnapshot: () => void;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function InventoryItemsTab({
  items,
  isLoading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showAvailableOnly,
  onToggleAvailableOnly,
  onSelectItem,
  onNewSnapshot,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: InventoryItemsTabProps) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por SKU, nome ou referência..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="AVAILABLE">Disponível</SelectItem>
                <SelectItem value="LOW_STOCK">Estoque baixo</SelectItem>
                <SelectItem value="UNAVAILABLE">Indisponível</SelectItem>
                <SelectItem value="RESERVED">Reservado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={showAvailableOnly ? 'default' : 'outline'}
              onClick={onToggleAvailableOnly}
            >
              {showAvailableOnly ? 'Somente disponíveis' : 'Filtrar disponíveis'}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-sm text-muted-foreground">
            Carregando snapshots de estoque...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Nenhum item operacional"
          description="Crie o primeiro snapshot para colocar o estoque sob monitoramento."
          actionLabel="Novo snapshot"
          onAction={onNewSnapshot}
        />
      ) : (
        <div className="space-y-4">
          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => onSelectItem(item)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.lastSyncedAt
                            ? `Atualizado em ${new Date(item.lastSyncedAt).toLocaleString('pt-BR')}`
                            : 'Sem sync'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.availableQuantity}</TableCell>
                    <TableCell>{formatCurrency(item.currentPrice)}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.availabilityStatus} />
                    </TableCell>
                    <TableCell>{formatSource(item.source)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <AppPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            currentItemsCount={items.length}
            itemLabel="itens"
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
