import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatSource, formatType, requiresInventoryControl } from '../utils/formatters';

interface CatalogItemsTableProps {
  items: any[];
  onSelectItem: (item: any) => void;
}

export function CatalogItemsTable({ items, onSelectItem }: CatalogItemsTableProps) {
  return (
    <Card className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Preço base</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => onSelectItem(item)}>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description || 'Sem descrição comercial'}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{formatType(item.type)}</Badge>
                  {requiresInventoryControl(item.type) ? (
                    <Badge variant="outline">Controla estoque</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{item.categoryName || '-'}</TableCell>
              <TableCell>{formatCurrency(item.basePrice)}</TableCell>
              <TableCell>{formatSource(item.source)}</TableCell>
              <TableCell>
                <StatusBadge status={item.active ? 'ACTIVE' : 'CLOSED'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
