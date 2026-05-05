import { PlugZap, RefreshCw } from 'lucide-react';
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
  onSyncConnection?: (connectionId: string) => void;
  syncPendingConnectionId?: string | null;
}

export function InventoryConnectionsTab({
  connections,
  isLoading,
  onNewConnection,
  onSyncConnection,
  syncPendingConnectionId,
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
      {connections.map((connection) => (
        <Card key={connection.id} className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{connection.providerName}</CardTitle>
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
            {connection.status === 'ACTIVE' && onSyncConnection ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                disabled={syncPendingConnectionId === connection.id}
                onClick={() => onSyncConnection(connection.id)}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncPendingConnectionId === connection.id ? 'animate-spin' : ''}`}
                />
                {syncPendingConnectionId === connection.id ? 'Sincronizando...' : 'Sincronizar agora'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
