import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { publicProposalsService } from '../services/public-proposals-service';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Sem validade definida';
  }

  const date = new Date(value);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicProposalPage() {
  const { token = '' } = useParams();

  const proposalQuery = useQuery({
    queryKey: ['public-proposal', token],
    queryFn: () => publicProposalsService.getByToken(token),
    enabled: Boolean(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => publicProposalsService.accept(token),
    onSuccess: async (data) => {
      await proposalQuery.refetch();
      if (data.payment?.url && typeof window !== 'undefined') {
        window.open(data.payment.url, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível aceitar a proposta',
        description: error.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => publicProposalsService.reject(token),
    onSuccess: async () => {
      await proposalQuery.refetch();
      toast({
        title: 'Proposta recusada',
        description: 'Registramos a sua resposta com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível recusar a proposta',
        description: error.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const proposal = proposalQuery.data;
  const isBusy = acceptMutation.isPending || rejectMutation.isPending;
  const totalItems = useMemo(
    () => proposal?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [proposal],
  );

  if (proposalQuery.isLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0b1727_48%,_#08111d_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando proposta...</span>
          </div>
        </div>
      </main>
    );
  }

  if (proposalQuery.isError || !proposal) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0b1727_48%,_#08111d_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <Card className="w-full border-white/10 bg-white/5 text-white shadow-2xl shadow-cyan-950/20">
            <CardContent className="space-y-4 p-8">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-400" />
                <div>
                  <h1 className="text-2xl font-semibold">Proposta indisponível</h1>
                  <p className="text-sm text-white/60">
                    Não conseguimos localizar este link. Ele pode ter expirado ou sido substituído.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                <Link to="/login">Voltar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_26%),linear-gradient(180deg,_#07111f_0%,_#0b1727_48%,_#08111d_100%)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(8,15,28,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-emerald-200">
                Contrato digital
              </Badge>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  {proposal.title}
                </h1>
                <p className="mt-3 max-w-3xl text-base text-white/65 md:text-lg">
                  {proposal.description || 'Revise os itens, confirme o aceite e siga para o pagamento em poucos passos.'}
                </p>
              </div>
            </div>

            <Card className="min-w-[280px] border-white/10 bg-[#0d1625] text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/35">Valor final</p>
                    <p className="mt-2 text-3xl font-black text-white">{formatCurrency(proposal.finalAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Validade</p>
                    <p className="mt-1 text-sm font-medium text-white/80">{formatDate(proposal.validUntil)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Itens</p>
                    <p className="mt-1 text-lg font-semibold text-white">{totalItems}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Base calculada</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(proposal.totalAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Assinatura via link protegido
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              Status: {proposal.approvalStatus === 'PENDING' ? 'Aguardando resposta' : proposal.approvalStatus === 'ACCEPTED' ? 'Aceita' : 'Recusada'}
            </span>
            {proposal.payment?.url ? (
              <a
                href={proposal.payment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-100 transition hover:bg-emerald-400/15"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir pagamento
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Itens da proposta</p>
                <h2 className="text-2xl font-bold">Escopo e valores</h2>
              </div>

              <div className="space-y-4">
                {proposal.items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-3xl border border-white/10 bg-[#0d1625] p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                        {item.description ? (
                          <p className="text-sm leading-6 text-white/60">{item.description}</p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                        <p className="mt-1 text-xl font-bold text-white">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {proposal.benefits ? (
                <>
                  <Separator className="bg-white/10" />
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.32em] text-white/35">Benefícios incluídos</p>
                    <p className="whitespace-pre-line text-sm leading-7 text-white/70">{proposal.benefits}</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Próximo passo</p>
                <h2 className="text-2xl font-bold">Responder à proposta</h2>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0d1625] p-5 text-sm leading-7 text-white/70">
                {proposal.approvalStatus === 'ACCEPTED' ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                      <div>
                        <p className="font-semibold text-white">Proposta aceita</p>
                        <p>
                          O aceite foi registado com sucesso. Se o pagamento já estiver disponível, você pode concluir agora mesmo.
                        </p>
                      </div>
                    </div>
                    {proposal.payment?.url ? (
                      <Button asChild className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-semibold text-slate-950 hover:bg-emerald-400">
                        <a href={proposal.payment.url} target="_blank" rel="noreferrer">
                          Seguir para o pagamento
                        </a>
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
                        Estamos a preparar o link de pagamento. Se ele não abrir automaticamente, atualize a página em alguns instantes.
                      </div>
                    )}
                  </div>
                ) : proposal.approvalStatus === 'REJECTED' ? (
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 text-white/60" />
                    <div>
                      <p className="font-semibold text-white">Proposta recusada</p>
                      <p>
                        O retorno foi registado. Se quiser rever condições, responda na conversa e a equipe pode ajustar a proposta.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <p>
                      Ao aceitar, o sistema regista o seu aceite e já libera o pagamento diretamente nesta mesma jornada.
                    </p>
                    <div className="grid gap-3">
                      <Button
                        className="h-12 rounded-2xl bg-emerald-500 text-base font-semibold text-slate-950 hover:bg-emerald-400"
                        onClick={() => acceptMutation.mutate()}
                        disabled={isBusy}
                      >
                        {acceptMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Aceitar e seguir para pagamento
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-2xl border-white/15 bg-transparent text-base text-white hover:bg-white/10"
                        onClick={() => rejectMutation.mutate()}
                        disabled={isBusy}
                      >
                        {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Recusar proposta
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
