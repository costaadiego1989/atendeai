import { Bell } from 'lucide-react';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';

export function AlertsHeader() {
  return (
    <div className="page-header mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Alertas
        </h1>
        <p className="page-description mt-1">
          Configure lembretes que o sistema envia no seu próprio WhatsApp para apoiar a rotina.
        </p>
      </div>
      <ModuleAgentRuleButton moduleId="alerts" className="gap-1.5" />
    </div>
  );
}
