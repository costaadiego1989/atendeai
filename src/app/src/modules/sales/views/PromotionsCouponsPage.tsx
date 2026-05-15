import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Gift, Ticket } from 'lucide-react';
import { PromotionsTab } from './PromotionsTab';
import { CouponsTab } from './CouponsTab';
import { PageTabsList } from '@/components/PageTabs';

export function PromotionsCouponsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Promoções & Cupons</h1>
          <p className="page-description mt-1">
            Gerencie ofertas comerciais, descontos programados e cupons de ativação.
          </p>
        </div>
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
