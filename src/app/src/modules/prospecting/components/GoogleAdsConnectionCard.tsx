import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, PlugZap, RefreshCw, Unplug } from 'lucide-react';
import { useGoogleAdsConnectionViewModel } from '@/modules/prospecting/view-models/useGoogleAdsConnectionViewModel';

export function GoogleAdsConnectionCard({
  vm,
}: {
  vm: ReturnType<typeof useGoogleAdsConnectionViewModel>;
}) {
  const connection = vm.connection;

  return (
    <Card className="glass-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                conexão Google Ads
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Conecte a conta do cliente por OAuth e escolha qual conta Ads sera usada.
            </p>
          </div>
          <Badge variant="secondary">
            {connection?.status === 'CONNECTED'
              ? 'Conectado'
              : connection?.status === 'PENDING_ACCOUNT_SELECTION'
                ? 'Escolha a conta'
                : 'não conectado'}
          </Badge>
        </div>

        {connection?.connected ? (
          <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
            <p className="font-medium text-foreground">
              {connection.googleEmail || 'Conta Google autorizada'}
            </p>
            <p className="mt-1 text-muted-foreground">
              {connection.accountSelected
                ? `Conta selecionada: ${connection.customerName || connection.customerId}`
                : 'Autorização concluida. Falta escolher a conta Ads.'}
            </p>
          </div>
        ) : null}

        {!connection?.connected ? (
          <Button
            className="gap-2"
            disabled={vm.startMutation.isPending}
            onClick={() => vm.startConnection()}
          >
            <Link2 className="h-4 w-4" />
            {vm.startMutation.isPending ? 'Abrindo Google...' : 'Conectar Google Ads'}
          </Button>
        ) : null}

        {connection?.connected && !connection.accountSelected ? (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                Escolha a conta Ads
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void vm.accountsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
            <div className="space-y-2">
              {vm.accounts.map((account) => (
                <div
                  key={account.customerId}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {account.descriptiveName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID {account.customerId}
                      {account.isManager ? ' • conta manager' : ' • conta cliente'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => vm.selectAccount(account.customerId)}
                    disabled={vm.selectAccountMutation.isPending}
                  >
                    Usar esta conta
                  </Button>
                </div>
              ))}
              {!vm.accounts.length && !vm.accountsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta acessivel retornada ainda.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {connection?.connected ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => vm.disconnect()}
              disabled={vm.disconnectMutation.isPending}
            >
              <Unplug className="h-4 w-4" />
              Desconectar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
