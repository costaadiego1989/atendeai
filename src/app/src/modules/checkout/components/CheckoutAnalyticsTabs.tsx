import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Badge } from '@/components/ui/badge';
import { Package, Users, TrendingUp, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency } from '@/shared/lib/formatters';

export interface ProductRankingItem {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface CustomerRankingItem {
  contactName: string;
  contactPhone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
}

interface CheckoutAnalyticsTabsProps {
  productRanking: ProductRankingItem[];
  customerRanking: CustomerRankingItem[];
}

export const CheckoutAnalyticsTabs: React.FC<CheckoutAnalyticsTabsProps> = ({
  productRanking,
  customerRanking,
}) => {
  const [activeTab, setActiveTab] = React.useState('products');

  return (
    <Card className="glass-card">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base font-semibold">Inteligência Comercial</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranking de produtos vendidos e clientes que mais compraram no período.
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <PageTabsList
            tabs={[
              { value: 'products', label: 'Produtos Vendidos', icon: Package },
              { value: 'customers', label: 'Clientes', icon: Users },
            ]}
          />

          <TabsContent value="products" className="mt-4">
            {productRanking.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Nenhum produto vendido"
                description="Assim que houver pedidos pagos, o ranking de produtos aparecerá aqui."
              />
            ) : (
              <div className="space-y-3">
                {productRanking.map((product, index) => (
                  <div
                    key={product.name}
                    className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-4 transition-colors hover:bg-background/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70">
                      <span className="text-sm font-bold text-primary">
                        {index + 1}º
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.orderCount} {product.orderCount === 1 ? 'pedido' : 'pedidos'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(product.totalRevenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.totalQuantity} {product.totalQuantity === 1 ? 'unidade' : 'unidades'}
                      </p>
                    </div>

                    {index === 0 && (
                      <Badge className="shrink-0 rounded-full border-amber-500/20 bg-amber-500/10 text-[10px] font-bold text-amber-400">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        Mais vendido
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            {customerRanking.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente identificado"
                description="Clientes aparecerão aqui conforme os pedidos forem concluídos."
              />
            ) : (
              <div className="space-y-3">
                {customerRanking.map((customer, index) => (
                  <div
                    key={`${customer.contactName}-${customer.contactPhone}`}
                    className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-4 transition-colors hover:bg-background/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70">
                      <span className="text-sm font-bold text-primary">
                        {index + 1}º
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {customer.contactName || 'Contato não identificado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.contactPhone}
                      </p>
                    </div>

                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.totalOrders} {customer.totalOrders === 1 ? 'pedido' : 'pedidos'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  );
};
