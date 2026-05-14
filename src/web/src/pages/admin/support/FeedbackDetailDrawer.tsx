import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface FeedbackReply {
  id: string;
  feedbackId: string;
  authorName: string;
  message: string;
  sentVia?: string | null;
  createdAt: string;
}

interface FeedbackDetail {
  feedback: {
    id: string;
    tenantId: string;
    tenantName?: string;
    userId: string;
    userName: string;
    userEmail: string;
    type: string;
    title: string;
    description: string;
    status: string;
    appModule?: string;
    pagePath?: string;
    createdAt: string;
    updatedAt: string;
  };
  replies: FeedbackReply[];
}

interface Props {
  feedbackId: string;
  onClose: () => void;
}

const statusOptions = ["OPEN", "REVIEWED", "CLOSED"] as const;

export default function FeedbackDetailDrawer({ feedbackId, onClose }: Props) {
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<FeedbackDetail>({
    queryKey: ["admin-feedback-detail", feedbackId],
    queryFn: () => adminFetch(`/platform/support/feedbacks/${feedbackId}`),
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      adminFetch(`/platform/support/feedbacks/${feedbackId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message, authorName: "Admin" }),
      }),
    onSuccess: (result: any) => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", feedbackId] });
      toast({
        title: "Resposta enviada",
        description: result.messageSent
          ? "Mensagem enviada via WhatsApp"
          : "Resposta salva (WhatsApp indisponível)",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar resposta", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      adminFetch(`/platform/support/feedbacks/${feedbackId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", feedbackId] });
      toast({ title: "Status atualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    },
  });

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyMutation.mutate(replyText.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Detalhes do Feedback</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Carregando...
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Feedback info */}
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-gray-900">{data.feedback.title}</h3>
              <div className="flex gap-2">
                <Badge>{data.feedback.type}</Badge>
                <Badge variant="outline">{data.feedback.status}</Badge>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{data.feedback.description}</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p><strong>Usuário:</strong> {data.feedback.userName} ({data.feedback.userEmail})</p>
                <p><strong>Tenant:</strong> {data.feedback.tenantName || data.feedback.tenantId}</p>
                {data.feedback.appModule && (
                  <p><strong>Módulo:</strong> {data.feedback.appModule}</p>
                )}
                {data.feedback.pagePath && (
                  <p><strong>Página:</strong> {data.feedback.pagePath}</p>
                )}
                <p><strong>Criado em:</strong> {new Date(data.feedback.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            </div>

            {/* Status actions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Alterar status:</p>
              <div className="flex gap-2">
                {statusOptions.map((s) => (
                  <Button
                    key={s}
                    variant={data.feedback.status === s ? "default" : "outline"}
                    size="sm"
                    disabled={data.feedback.status === s || statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Replies */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">
                Respostas ({data.replies.length})
              </h4>
              {data.replies.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma resposta ainda</p>
              ) : (
                data.replies.map((reply) => (
                  <div key={reply.id} className="bg-blue-50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">
                        {reply.authorName}
                      </span>
                      <span className="text-xs text-blue-600">
                        {new Date(reply.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{reply.message}</p>
                    {reply.sentVia && (
                      <span className="text-xs text-blue-500">
                        Enviado via {reply.sentVia}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Reply form */}
            <form onSubmit={handleReply} className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Responder</h4>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escreva sua resposta... (será enviada via WhatsApp)"
                rows={4}
              />
              <Button
                type="submit"
                disabled={!replyText.trim() || replyMutation.isPending}
                className="w-full"
              >
                {replyMutation.isPending ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
