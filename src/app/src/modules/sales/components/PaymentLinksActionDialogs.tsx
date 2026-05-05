import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PaymentLinksPageViewModel } from '@/modules/sales/view-models/usePaymentLinksPageViewModel';

type Props = {
  vm: PaymentLinksPageViewModel;
};

export function PaymentLinksActionDialogs({ vm }: Props) {
  return (
    <>
      <AlertDialog
        open={!!vm.pauseTarget}
        onOpenChange={(open) => !open && vm.setPauseTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente pausar {vm.pauseTarget?.name}? Ela deixará de aceitar
              novos pagamentos até ser reativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => vm.setPauseTarget(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={vm.confirmPause}
              disabled={vm.pauseMutation.isPending}
            >
              Confirmar pausa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!vm.resumeTarget}
        onOpenChange={(open) => !open && vm.setResumeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reativar {vm.resumeTarget?.name} para voltar a receber pagamentos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => vm.setResumeTarget(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={vm.confirmResume}
              disabled={vm.resumeMutation.isPending}
            >
              Reativar cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!vm.deleteTarget}
        onOpenChange={(open) => !open && vm.setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir {vm.deleteTarget?.name}? Essa ação remove a
              cobrança da operação ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => vm.setDeleteTarget(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={vm.confirmDelete}
              disabled={vm.deleteMutation.isPending}
            >
              Excluir cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
