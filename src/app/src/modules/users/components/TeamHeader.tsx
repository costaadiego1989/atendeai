import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';

interface TeamHeaderProps {
  onNewMember: () => void;
}

export function TeamHeader({ onNewMember }: TeamHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Equipe
        </h1>
        <p className="page-description mt-1">
          Convide administradores e agentes. A senha provisória é enviada por e-mail e a troca ocorre no primeiro login.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ModuleAgentRuleButton moduleId="team" buttonSize="sm" className="gap-1.5" />
        <Button size="sm" className="gap-1.5 w-fit" onClick={onNewMember}>
          <Plus className="h-4 w-4" /> Novo membro
        </Button>
      </div>
    </div>
  );
}
