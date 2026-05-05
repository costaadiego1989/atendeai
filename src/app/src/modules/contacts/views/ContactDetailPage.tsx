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
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { CardContent } from '@/components/ui/card';
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

          <Card className="glass-card overflow-hidden">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-base">Relacionamento comercial</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
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
                  <CardContent className="px-0 pb-0">
                    <ContactTimeline entries={vm.timeline} />
                  </CardContent>
                </TabsContent>

                <TabsContent value="pipeline" className="mt-5">
                  <CardContent className="space-y-4 px-0 pb-0">
                    <ContactStageBoard
                      contact={vm.contact}
                      stageOptions={vm.stageOptions}
                      draggingStage={vm.draggingStage}
                      onDraggingStageChange={vm.setDraggingStage}
                      onStageChange={vm.updateStage}
                    />
                  </CardContent>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
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
