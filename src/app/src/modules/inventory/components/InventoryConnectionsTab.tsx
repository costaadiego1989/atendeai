import { CheckCircle2, Loader2, PlugZap, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatSource } from '../utils/inventory-helpers';

interface InventoryConnection {
  id: string;
  providerName: string;
  sourceType: string;
  status: string;
  configSummary?: string;
  lastSyncedAt?: string;
}

interface InventoryConnectionsTabProps {
  connections: InventoryConnection[];
  isLoading: boolean;
  onNewConnection: () => void;
  onSyncConnection?: (connectionId: string, providerName: string) => void;
  syncPendingConnectionId?: string | null;
  lastSyncResult?: { connectionId: string; success: boolean; timestamp: number } | null;
}

export function InventoryConnectionsTab({
  connections,
  isLoading,
  onNewConnection,
  onSyncConnection,
  syncPendingConnectionId,
  lastSyncResult,
}: InventoryConnectionsTabProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-sm text-muted-foreground">
          Carregando conexões...
        </CardContent>
      </Card>
    );
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        icon={PlugZap}
        title="Nenhuma conexão registrada"
        description="Vá para as Configurações de Integrações para conectar seu ERP, PDV ou e-commerce."
        actionLabel="Gerenciar Integrações"
        onAction={onNewConnection}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {connections.map((connection) => {
        const isSyncing = syncPendingConnectionId === connection.id;
        const justSucceeded =
          lastSyncResult?.connectionId === connection.id && lastSyncResult.success;
        const justFailed =
          lastSyncResult?.connectionId === connection.id && !lastSyncResult.success;

        return (
          <Card
            key={connection.id}
            className={[
              'glass-card transition-all duration-300',
              isSyncing ? 'border-primary/50 shadow-md shadow-primary/10' : '',
              justSucceeded ? 'border-success/40' : '',
              justFailed ? 'border-destructive/40' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{connection.providerName}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatSource(connection.sourceType)}
                  </p>
                </div>
                <StatusBadge status={connection.status} />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {connection.configSummary || 'Conexão registrada sem resumo configurado.'}
              </p>

              <div className="text-xs text-muted-foreground">
                {connection.lastSyncedAt
                  ? `Última sincronização em ${new Date(connection.lastSyncedAt).toLocaleString('pt-BR')}`
                  : 'Ainda sem sincronização executada'}
              </div>

              {/* sync result flash */}
              {justSucceeded && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Sincronização concluída com sucesso
                </div>
              )}
              {justFailed && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  Falha na última sincronização
                </div>
              )}

              {/* syncing progress bar */}
              {isSyncing && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando itens do fornecedor…
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full animate-pulse rounded-full bg-primary/60" style={{ width: '60%' }} />
                  </div>
                </div>
              )}

              {connection.status === 'ACTIVE' && onSyncConnection ? (
                <Button
                  type="button"
                  variant={isSyncing ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-2 rounded-xl"
                  disabled={isSyncing}
                  onClick={() => onSyncConnection(connection.id, connection.providerName)}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
