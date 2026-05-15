import { ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface BillingHeaderProps {
  onConfirmCancel: () => void;
  cancelOpen: boolean;
  setCancelOpen: (open: boolean) => void;
  isPendingCancel: boolean;
  isTrial?: boolean;
}

export function BillingHeader({
  onConfirmCancel,
  cancelOpen,
  setCancelOpen,
  isPendingCancel,
  isTrial,
}: BillingHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Consumo & Faturamento</h1>
        <p className="page-description mt-1">
          Gestão estratégica de recursos e governança da assinatura.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {!isTrial && (
          <div className="flex items-center gap-2 rounded-full bg-secondary/50 px-4 py-1.5 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Pagamento recorrente
          </div>
        )}

        {!isTrial && (
          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                Encerrar assinatura
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar assinatura recorrente</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao confirmar, a renovação automática será desativada. O acesso permanecerá disponível até o final do ciclo atual.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção operacional
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A suspensão da assinatura impactará diretamente os fluxos de IA e disparos automáticos após o vencimento.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCancelOpen(false)}>
                  Manter ativa
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={onConfirmCancel}
                  disabled={isPendingCancel}
                >
                  Confirmar encerramento
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
