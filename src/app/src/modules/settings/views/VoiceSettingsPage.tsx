import { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Button } from '@/components/ui/button';
import { Bot, FileText, PhoneCall, BarChart3 } from 'lucide-react';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { useVoiceSettingsViewModel } from '../view-models/useVoiceSettingsViewModel';
import { VoiceAgentConfig } from '../components/VoiceAgentConfig';
import { VoiceScriptsEditor } from '../components/VoiceScriptsEditor';
import { VoiceRecoveryIntegration } from '../components/VoiceRecoveryIntegration';
import { VoiceCallsHistory } from '../components/VoiceCallsHistory';
import { VoiceMetricsCards } from '../components/VoiceMetricsCards';
import type { VoiceConfig, VoiceScript, VoiceRecoveryConfig } from '../services/voice-service';

export function VoiceSettingsPage() {
  const vm = useVoiceSettingsViewModel();

  // Local state for form editing
  const [localConfig, setLocalConfig] = useState<VoiceConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (vm.config) {
      setLocalConfig(vm.config);
      setIsDirty(false);
    }
  }, [vm.config]);

  const handleConfigChange = (partial: Partial<VoiceConfig>) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, ...partial });
    setIsDirty(true);
  };

  const handleScriptsChange = (scripts: VoiceScript[]) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, scripts });
    setIsDirty(true);
  };

  const handleRecoveryChange = (recovery: VoiceRecoveryConfig) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, recovery });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!localConfig) return;
    await vm.saveConfig(localConfig);
    setIsDirty(false);
  };

  if (vm.isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Agente de Voz</h1>
          <p className="page-description">Configure o agente de voz com IA para cobrança automatizada, confirmações e follow-up.</p>
        </div>
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Agente de Voz</h1>
          <p className="page-description mt-1">
            Configure o agente de voz com IA para cobrança automatizada, confirmações e follow-up.
          </p>
        </div>
        <Button onClick={handleSave} disabled={vm.isSaving || !isDirty}>
          {vm.isSaving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>

      <Tabs defaultValue="agent" className="space-y-5">
        <PageTabsList
          tabs={[
            { value: 'agent', label: 'Agente', icon: Bot },
            { value: 'scripts', label: 'Scripts', icon: FileText },
            { value: 'recovery', label: 'Cobrança', icon: PhoneCall },
            { value: 'history', label: 'Histórico', icon: BarChart3 },
          ]}
        />

        <TabsContent value="agent">
          {localConfig && (
            <VoiceAgentConfig config={localConfig} onChange={handleConfigChange} />
          )}
        </TabsContent>

        <TabsContent value="scripts">
          {localConfig && (
            <VoiceScriptsEditor
              scripts={localConfig.scripts}
              onChange={handleScriptsChange}
            />
          )}
        </TabsContent>

        <TabsContent value="recovery">
          {localConfig && (
            <VoiceRecoveryIntegration
              recovery={localConfig.recovery}
              onChange={handleRecoveryChange}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <VoiceMetricsCards metrics={vm.metrics} />
          <VoiceCallsHistory calls={vm.calls} isLoading={vm.isLoadingCalls} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
