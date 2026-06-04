import { Link } from 'react-router-dom';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ArrowLeft, UserRound, History, GitMerge } from 'lucide-react';
import { useContactDetailViewModel } from '@/modules/contacts/view-models/useContactDetailViewModel';
import { ContactSummaryCard } from '../components/ContactSummaryCard';
import { ContactTimeline } from '../components/ContactTimeline';
import { ContactStageBoard } from '../components/ContactStageBoard';
import { EditContactSheet } from '../components/EditContactSheet';

export default function ContactDetailPage() {
  const vm = useContactDetailViewModel();

  if (!vm.contact && !vm.contactQuery.isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <EmptyState
          icon={UserRound}
          title="Contato não encontrado"
          description="Esse contato pode ter sido removido ou ainda não foi carregado no CRM."
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <Link
        to="/app/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para contatos
      </Link>

      {vm.contact ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <ContactSummaryCard
              contact={vm.contact}
              onEdit={() => vm.setEditOpen(true)}
              onDelete={() => vm.setDeleteOpen(true)}
              onOpenConversation={vm.openConversation}
              isOpeningConversation={vm.openConversationMutation.isPending}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Relacionamento comercial</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Alterne entre histórico completo e a visão de funil do contato.
              </p>
            </div>
            <Tabs defaultValue="timeline" className="space-y-0">
              <PageTabsList
                tabs={[
                  { value: 'timeline', label: 'Timeline', icon: History },
                  { value: 'pipeline', label: 'Funil', icon: GitMerge },
                ]}
                className="mb-5"
              />

              <TabsContent value="timeline" className="mt-5">
                <ContactTimeline entries={vm.timeline} />
              </TabsContent>

              <TabsContent value="pipeline" className="mt-5">
                    <ContactStageBoard
                      contact={vm.contact}
                      stageOptions={[
                        { value: 'LEAD', label: 'Lead', description: 'Contato inicial com potencial' },
                        { value: 'PROSPECT', label: 'Prospect', description: 'Interesse demonstrado' },
                        { value: 'OPPORTUNITY', label: 'Oportunidade', description: 'Proposta em negociação' },
                        { value: 'CUSTOMER', label: 'Cliente', description: 'Negócio fechado' },
                        { value: 'INACTIVE', label: 'Inativo', description: 'Sem interesse atual' },
                      ]}
                      draggingStage={vm.draggingStage}
                      onDraggingStageChange={vm.setDraggingStage}
                      onStageChange={vm.updateStage}
                    />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : null}

      <EditContactSheet
        open={vm.editOpen}
        onOpenChange={vm.setEditOpen}
        form={vm.editForm}
        onFormChange={vm.updateEditForm}
        onSubmit={vm.submitEdit}
        isPending={vm.updateContactMutation.isPending}
      />

      <AlertDialog open={vm.deleteOpen} onOpenChange={vm.setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato do CRM?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação exclui o contato da base operacional. Use apenas quando
              tiver certeza de que ele não deve mais permanecer no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={vm.deleteContact}
            >
              Remover contato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
