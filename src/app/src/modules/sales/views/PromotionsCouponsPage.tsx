import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Gift, Ticket } from 'lucide-react';
import { PromotionsTab } from './PromotionsTab';
import { CouponsTab } from './CouponsTab';
import { PageTabsList } from '@/components/PageTabs';

export function PromotionsCouponsPage() {
  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Promoções & Cupons
        </h1>
        <p className="page-description mt-1">
          Gerencie ofertas comerciais, descontos programados e cupons de ativação.
        </p>
      </div>

      <Tabs defaultValue="promotions" className="w-full">
        <PageTabsList
          containerClassName="mb-6"
          tabs={[
            { value: 'promotions', label: 'Promoções', icon: Gift },
            { value: 'coupons', label: 'Cupons', icon: Ticket },
          ]}
        />
        <TabsContent value="promotions" className="mt-0">
          <PromotionsTab />
        </TabsContent>
        <TabsContent value="coupons" className="mt-0">
          <CouponsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
