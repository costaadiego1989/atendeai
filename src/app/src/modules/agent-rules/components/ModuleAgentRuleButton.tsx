import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AGENT_MODULES_CONFIG, type AgentRuleModuleId } from '@/modules/agent-rules/constants/agent-rule-modules';
import { ModuleAgentRuleDialog } from '@/modules/agent-rules/components/ModuleAgentRuleDialog';
import { useModuleAgentRuleViewModel } from '@/modules/agent-rules/view-models/useModuleAgentRuleViewModel';

type Props = {
  moduleId: AgentRuleModuleId;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
};

export function ModuleAgentRuleButton({
  moduleId,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className,
}: Props) {
  const config = AGENT_MODULES_CONFIG[moduleId];
  const vm = useModuleAgentRuleViewModel(config);

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className={className}
        onClick={() => vm.setOpen(true)}
      >
        <Bot className="mr-2 h-4 w-4" />
        Personalizar IA
      </Button>

      <ModuleAgentRuleDialog vm={vm} />
    </>
  );
}
