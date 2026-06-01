import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Package, Users, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency } from '@/shared/lib/formatters';
import type { CheckoutAnalyticsSubTab } from '@/modules/checkout/view-models/useCheckoutOrdersViewModel';

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
  activeTab: CheckoutAnalyticsSubTab;
  onTabChange: (tab: CheckoutAnalyticsSubTab) => void;
}

const productChartConfig = {
  totalRevenue: { label: 'Receita', color: 'hsl(var(--primary))' },
};

function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export const CheckoutAnalyticsTabs: React.FC<CheckoutAnalyticsTabsProps> = ({
  productRanking,
  customerRanking,
  activeTab,
  onTabChange,
}) => {
  const productChartData = productRanking.slice(0, 10).map((product) => ({
    name: product.name,
    label: product.name.length > 22 ? `${product.name.slice(0, 21)}…` : product.name,
    totalRevenue: product.totalRevenue,
    totalQuantity: product.totalQuantity,
    orderCount: product.orderCount,
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base font-semibold">Inteligência Comercial</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranking de produtos vendidos e clientes que mais compraram no período.
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as CheckoutAnalyticsSubTab)}>
          <PageTabsList
            tabs={[
              { value: 'products', label: 'Produtos Vendidos', icon: Package },
              { value: 'customers', label: 'Clientes', icon: Users },
            ]}
          />

          <TabsContent value="products" className="mt-4">
            {productChartData.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Nenhum produto vendido"
                description="Assim que houver pedidos pagos, o ranking de produtos aparecerá aqui."
              />
            ) : (
              <ChartContainer
                config={productChartConfig}
                className="h-[360px] w-full"
              >
                <BarChart
                  data={productChartData}
                  layout="vertical"
                  margin={{ left: 12, right: 16 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatChartCurrency(Number(value))}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={140}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="label"
                        formatter={(value) => formatChartCurrency(Number(value))}
                      />
                    }
                  />
                  <Bar
                    dataKey="totalRevenue"
                    fill="var(--color-totalRevenue)"
                    radius={[0, 10, 10, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ChartContainer>
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
