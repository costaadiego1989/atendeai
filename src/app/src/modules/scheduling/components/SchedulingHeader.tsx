import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';

export function SchedulingHeader() {
  return (
    <div className="page-header flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <h1 className="page-title">Agenda operacional</h1>
        <p className="page-description max-w-2xl">
          Organize profissionais, serviços, disponibilidade diária e reservas vindas do relacionamento comercial.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <ModuleAgentRuleButton moduleId="scheduling" className="h-9" />
      </div>
    </div>
  );
}
