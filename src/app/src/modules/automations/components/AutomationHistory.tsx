import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  GitBranch, 
  GitCommit, 
  GitCompare, 
  RotateCcw, 
  Share2, 
  Users, 
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { Automation, CreateAutomationInput } from '../types';

interface AutomationVersion {
  id: string;
  automationId: string;
  version: number;
  data: Automation;
  reason: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  changes: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
}

interface VersionDiff {
  added: string[];
  removed: string[];
  modified: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  summary: string;
}

interface AutomationHistoryProps {
  automation: Automation;
  onVersionRestore?: (version: AutomationVersion) => void;
  onVersionDelete?: (versionId: string) => void;
  currentVersion?: number;
}

interface VersionCardProps {
  version: AutomationVersion;
  isCurrent: boolean;
  onRestore: (version: AutomationVersion) => void;
  onDelete: (versionId: string) => void;
  onView: (version: AutomationVersion) => void;
}

function VersionCard({ version, isCurrent, onRestore, onDelete, onView }: VersionCardProps) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <Card className={`${isCurrent ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              <span className="font-semibold">Versão {version.version}</span>
              {isCurrent && (
                <Badge variant="default" className="text-xs">Atual</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{version.reason}</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(version)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!isCurrent && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestore(version)}
                  className="h-8 w-8 p-0"
                  title="Restaurar versão"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  className="h-8 w-8 p-0"
                  title="Ver diferenças"
                >
                  <GitCompare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(version.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="Excluir versão"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {version.createdBy.name}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(version.createdAt).toLocaleDateString('pt-BR')}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(version.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </CardHeader>

      {showDiff && (
        <CardContent>
          <div className="space-y-3">
            {version.changes.added.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-1">Adicionado</h4>
                <ul className="text-xs text-green-600 space-y-1">
                  {version.changes.added.map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {version.changes.removed.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-1">Removido</h4>
                <ul className="text-xs text-red-600 space-y-1">
                  {version.changes.removed.map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {version.changes.modified.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-600 mb-1">Modificado</h4>
                <div className="space-y-2">
                  {version.changes.modified.map((change, index) => (
                    <div key={index} className="bg-muted/50 p-2 rounded text-xs">
                      <div className="font-medium">{change.field}</div>
                      <div className="flex justify-between mt-1">
                        <span className="text-red-600">De: {String(change.oldValue)}</span>
                        <span className="text-green-600">Para: {String(change.newValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function VersionModal({ 
  version, 
  onClose, 
  onRestore 
}: { 
  version: AutomationVersion; 
  onClose: () => void; 
  onRestore: (version: AutomationVersion) => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Versão {version.version}
          </DialogTitle>
          <DialogDescription>{version.reason}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] px-6 pb-2">
          <div className="space-y-6">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Criado por:</span>
                <p>{version.createdBy.name} ({version.createdBy.email})</p>
              </div>
              <div>
                <span className="font-medium">Data:</span>
                <p>{new Date(version.createdAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <Separator />

            {/* Automation Details */}
            <div>
              <h4 className="font-semibold mb-3">Detalhes da Automação</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <p className="text-sm bg-muted p-2 rounded">{version.data.name}</p>
                </div>
                
                {version.data.description && (
                  <div>
                    <label className="text-sm font-medium">Descrição</label>
                    <p className="text-sm bg-muted p-2 rounded">{version.data.description}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Gatilho</label>
                  <div className="bg-muted p-2 rounded text-sm">
                    <div className="font-medium">{version.data.trigger.type}</div>
                    <pre className="text-xs mt-1">{JSON.stringify(version.data.trigger.config, null, 2)}</pre>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Passos ({version.data.steps.length})</label>
                  <div className="space-y-2 mt-2">
                    {version.data.steps.map((step, index) => (
                      <div key={step.id || index} className="bg-muted p-2 rounded text-sm">
                        <div className="font-medium">{index + 1}. {step.type}</div>
                        <pre className="text-xs mt-1">{JSON.stringify(step.config, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pb-4">
              <Button onClick={() => onRestore(version)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar esta versão
              </Button>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mock version data generator
function generateMockVersions(automation: Automation): AutomationVersion[] {
  const versions = [
    {
      id: 'version-1',
      automationId: automation.id,
      version: 1,
      data: { ...automation, name: 'Versão Inicial' },
      reason: 'Criação da automação',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: { id: 'user-1', name: 'João Silva', email: 'joao@empresa.com' },
      changes: { added: ['Automação criada'], removed: [], modified: [] },
    },
    {
      id: 'version-2',
      automationId: automation.id,
      version: 2,
      data: { 
        ...automation, 
        name: 'Boas-vindas aprimorada',
        steps: [
          ...automation.steps.slice(0, 1),
          { type: 'WAIT_DELAY', config: { delayHuman: '30m' }, order: 1 },
          ...automation.steps.slice(1),
        ]
      },
      reason: 'Adicionado delay entre mensagens',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: { id: 'user-2', name: 'Maria Santos', email: 'maria@empresa.com' },
      changes: { 
        added: ['Passo de espera'], 
        removed: [], 
        modified: [{ field: 'name', oldValue: 'Versão Inicial', newValue: 'Boas-vindas aprimorada' }] 
      },
    },
    {
      id: 'version-3',
      automationId: automation.id,
      version: 3,
      data: automation,
      reason: 'Ajuste na mensagem de boas-vindas',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: { id: 'user-1', name: 'João Silva', email: 'joao@empresa.com' },
      changes: { 
        added: [], 
        removed: [], 
        modified: [{ field: 'steps.0.config.body', oldValue: 'Olá! Seja bem-vindo(a)!', newValue: 'Olá! Seja bem-vindo(a) ao AtendeAi! 😊' }] 
      },
    },
  ];

  return versions;
}

export function AutomationHistory({ 
  automation, 
  onVersionRestore, 
  onVersionDelete,
  currentVersion = 3 
}: AutomationHistoryProps) {
  const [versions, setVersions] = useState<AutomationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<AutomationVersion | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<AutomationVersion | null>(null);

  useEffect(() => {
    // In a real app, this would fetch from an API
    setVersions(generateMockVersions(automation));
  }, [automation.id]);

  const handleRestore = (version: AutomationVersion) => {
    setShowRestoreConfirm(version);
  };

  const confirmRestore = () => {
    if (showRestoreConfirm) {
      onVersionRestore?.(showRestoreConfirm);
      setShowRestoreConfirm(null);
    }
  };

  const handleDelete = (versionId: string) => {
    if (confirm('Tem certeza que deseja excluir esta versão?')) {
      onVersionDelete?.(versionId);
      setVersions(versions.filter(v => v.id !== versionId));
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(versions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `automação-${automation.id}-histórico.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Versões
          </h3>
          <p className="text-sm text-muted-foreground">
            {versions.length} versões registradas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
        </div>
      </div>

      {/* Version List */}
      <div className="space-y-3">
        {versions.map((version) => (
          <VersionCard
            key={version.id}
            version={version}
            isCurrent={version.version === currentVersion}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onView={(v) => setSelectedVersion(v)}
          />
        ))}
      </div>

      {/* Version Detail Modal */}
      {selectedVersion && (
        <VersionModal
          version={selectedVersion}
          onClose={() => setSelectedVersion(null)}
          onRestore={handleRestore}
        />
      )}

      {/* Restore Confirmation Modal */}
      <AlertDialog open={!!showRestoreConfirm} onOpenChange={(open) => { if (!open) setShowRestoreConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar versão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja restaurar a versão {showRestoreConfirm?.version}?
              Isso substituirá a versão atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}