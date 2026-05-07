import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  PencilLine,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { publicProposalsService } from '../services/public-proposals-service';

function toSafeCurrencyValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toSafeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatCurrency(value: unknown) {
  return toSafeCurrencyValue(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Sem validade definida';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sem validade definida';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem data registrada';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sem data registrada';
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getApprovalLabel(status?: 'PENDING' | 'ACCEPTED' | 'REJECTED') {
  if (status === 'ACCEPTED') {
    return 'Aceita';
  }

  if (status === 'REJECTED') {
    return 'Recusada';
  }

  return 'Aguardando resposta';
}

export default function PublicProposalPage() {
  const { token = '' } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [signerName, setSignerName] = useState('');
  const [signatureDirty, setSignatureDirty] = useState(false);

  const proposalQuery = useQuery({
    queryKey: ['public-proposal', token],
    queryFn: () => publicProposalsService.getByToken(token),
    enabled: Boolean(token),
  });

  const proposal = proposalQuery.data;
  const proposalErrorMessage =
    proposalQuery.error instanceof Error
      ? proposalQuery.error.message
      : 'Não conseguimos localizar este link. Ele pode ter expirado ou sido substituído.';
  const items = useMemo(
    () => (Array.isArray(proposal?.items) ? proposal.items : []),
    [proposal?.items],
  );
  const totalAmount = toSafeCurrencyValue(proposal?.totalAmount);
  const finalAmount = toSafeCurrencyValue(
    proposal?.finalAmount ?? proposal?.totalAmount,
  );
  const safeTitle = toSafeText(proposal?.title, 'Proposta comercial');
  const safeDescription = toSafeText(
    proposal?.description,
    'Revise os itens, confirme o aceite e siga para o pagamento em poucos passos.',
  );
  const safeBenefits =
    typeof proposal?.benefits === 'string' && proposal.benefits.trim()
      ? proposal.benefits.trim()
      : '';
  const hasContractContent = Boolean(
    items.length ||
      (typeof proposal?.description === 'string' && proposal.description.trim()) ||
      safeBenefits ||
      (typeof proposal?.title === 'string' && proposal.title.trim()) ||
      proposal?.payment?.url,
  );
  const totalItems = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)),
        0,
      ),
    [items],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.5;
    context.strokeStyle = '#f8fafc';
    context.fillStyle = '#0d1625';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!proposal?.signature?.signerName || signerName.trim()) {
      return;
    }

    setSignerName(proposal.signature.signerName);
  }, [proposal?.signature?.signerName, signerName]);

  const acceptMutation = useMutation({
    mutationFn: () => {
      const signatureDataUrl = canvasRef.current?.toDataURL('image/png') ?? '';

      return publicProposalsService.accept(token, {
        signerName: signerName.trim(),
        signatureDataUrl,
      });
    },
    onSuccess: async (data) => {
      await proposalQuery.refetch();
      toast({
        title: 'Aceite registrado',
        description: 'A assinatura foi salva e o pagamento já pode seguir.',
      });

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
  const isBusy = acceptMutation.isPending || rejectMutation.isPending;

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function beginSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getCanvasPoint(event);

    if (!canvas || !context || !point) {
      return;
    }

    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getCanvasPoint(event);

    if (!canvas || !context || !point) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
    setSignatureDirty(true);
  }

  function endSignature() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0d1625';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDirty(false);
  }

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
                    {proposalErrorMessage}
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-transparent text-white hover:bg-white/10"
              >
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
        <div className="mb-8 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(8,15,28,0.45)] backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-4">
              <Badge className="w-fit border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-emerald-200">
                Contrato digital
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  {safeTitle}
                </h1>
                <p className="max-w-3xl text-base text-white/65 md:text-lg">
                  {safeDescription}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Assinatura digital protegida
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  Status: {getApprovalLabel(proposal.approvalStatus)}
                </span>
                {proposal.signature?.hasSignature ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-100">
                    <PencilLine className="h-4 w-4" />
                    Assinado por {toSafeText(proposal.signature.signerName, 'cliente')}
                  </span>
                ) : null}
              </div>
            </div>

            <Card className="border-white/10 bg-[#0d1625] text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/35">Valor final</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {formatCurrency(finalAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Validade</p>
                    <p className="mt-1 text-sm font-medium text-white/80">
                      {formatDate(proposal.validUntil)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Itens</p>
                    <p className="mt-1 text-lg font-semibold text-white">{totalItems}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Base calculada</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>

                {proposal.payment?.url ? (
                  <a
                    href={proposal.payment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir pagamento
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/35">Itens da proposta</p>
                <h2 className="text-2xl font-bold">Escopo e valores</h2>
              </div>

              {items.length ? (
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const quantity = Math.max(0, Number(item.quantity ?? 0));
                    const unitPrice = toSafeCurrencyValue(item.unitPrice);
                    const subtotal =
                      toSafeCurrencyValue(item.subtotal) || quantity * unitPrice;

                    return (
                      <div
                        key={`${toSafeText(item.name, 'item')}-${index}`}
                        className="rounded-3xl border border-white/10 bg-[#0d1625] p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-white">
                              {toSafeText(item.name, `Item ${index + 1}`)}
                            </h3>
                            {item.description ? (
                              <p className="text-sm leading-6 text-white/60">{item.description}</p>
                            ) : null}
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                              {quantity} x {formatCurrency(unitPrice)}
                            </p>
                            <p className="mt-1 text-xl font-bold text-white">
                              {formatCurrency(subtotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-[#0d1625] p-5 text-sm leading-7 text-white/60">
                  {hasContractContent
                    ? 'Esta proposta não possui itens detalhados disponíveis neste link.'
                    : 'Esta proposta foi publicada sem detalhes comerciais suficientes. Peça à equipe para reenviar o contrato com os dados completos.'}
                </div>
              )}

              {safeBenefits ? (
                <>
                  <Separator className="bg-white/10" />
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.32em] text-white/35">Benefícios incluídos</p>
                    <p className="whitespace-pre-line text-sm leading-7 text-white/70">
                      {safeBenefits}
                    </p>
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
                          O aceite foi registrado com sucesso. Se o pagamento já estiver disponível, você pode concluir agora mesmo.
                        </p>
                        {proposal.signature?.signedAt ? (
                          <p className="mt-2 text-xs text-white/55">
                            Assinada em {formatDateTime(proposal.signature.signedAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {proposal.payment?.url ? (
                      <Button className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-semibold text-slate-950 hover:bg-emerald-400" asChild>
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
                        O retorno foi registrado. Se quiser rever condições, responda na conversa e a equipe pode ajustar a proposta.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <p>
                      Ao aceitar, o sistema registra o aceite, salva a assinatura digital e já libera o pagamento diretamente nesta mesma jornada.
                    </p>

                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Nome do signatário
                        </label>
                        <Input
                          value={signerName}
                          onChange={(event) => setSignerName(event.target.value)}
                          placeholder="Digite o nome completo"
                          className="h-11 rounded-2xl border-white/10 bg-[#08111d] text-white placeholder:text-white/30"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Assinatura digital
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 rounded-xl px-3 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                            onClick={clearSignature}
                          >
                            Limpar
                          </Button>
                        </div>
                        <canvas
                          ref={canvasRef}
                          width={640}
                          height={180}
                          className="h-40 w-full rounded-2xl border border-white/10 bg-[#0d1625] touch-none"
                          onPointerDown={beginSignature}
                          onPointerMove={drawSignature}
                          onPointerUp={endSignature}
                          onPointerLeave={endSignature}
                        />
                        <p className="text-xs text-white/45">
                          Assine com o dedo ou mouse para concluir o aceite.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <Button
                        className="h-12 rounded-2xl bg-emerald-500 text-base font-semibold text-slate-950 hover:bg-emerald-400"
                        onClick={() => acceptMutation.mutate()}
                        disabled={isBusy || !signerName.trim() || !signatureDirty}
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Aceitar e seguir para pagamento
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-2xl border-white/15 bg-transparent text-base text-white hover:bg-white/10"
                        onClick={() => rejectMutation.mutate()}
                        disabled={isBusy}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
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
