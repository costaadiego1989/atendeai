import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';
import { resolveFeedbackAppModule } from '@/shared/constants/feedback-app-module';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  supportService,
  type CreateSupportFeedbackInput,
} from '@/modules/support/services/support-service';

type FeedbackType = CreateSupportFeedbackInput['type'];

export function ModuleFeedbackFab() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pagePath, setPagePath] = useState(location.pathname);

  const area = resolveFeedbackAppModule(location.pathname);

  const createMutation = useMutation({
    mutationFn: () =>
      supportService.createFeedback({
        branchId: activeBranchId ?? undefined,
        type,
        title: title.trim(),
        description: description.trim(),
        pagePath: pagePath.trim() || location.pathname,
        appModule: area.code,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['support-feedbacks'] });
      setTitle('');
      setDescription('');
      setPagePath(location.pathname);
      setOpen(false);
      toast({
        title: 'Feedback enviado',
        description: 'Obrigado. Registámos a sua mensagem para o time técnico.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível enviar',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Tente novamente em instantes.',
        }),
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="fixed bottom-6 right-6 z-[45] h-14 w-14 shrink-0 rounded-full p-0 shadow-lg"
        aria-label={`Feedback (${area.label})`}
        onClick={() => {
          setPagePath(location.pathname);
          setOpen(true);
        }}
      >
        <MessageCirclePlus className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suporte e feedback</DialogTitle>
            <DialogDescription>
              Módulo: <span className="font-semibold text-foreground">{area.label}</span>{' '}
              <span className="font-mono text-xs text-muted-foreground">({area.code})</span>
              . Esta informação ajuda-nos a priorizar correções e melhorias.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v: FeedbackType) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUG">Bug</SelectItem>
                  <SelectItem value="SUGGESTION">Sugestão</SelectItem>
                  <SelectItem value="IMPROVEMENT">Melhoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumo curto"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que ocorreu, que resultado esperava, passos para reproduzir…"
              />
            </div>

            <Button
              className="w-full gap-2"
              disabled={
                createMutation.isPending ||
                title.trim().length < 4 ||
                description.trim().length < 8
              }
              onClick={() => createMutation.mutate()}
            >
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
