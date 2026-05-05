import { Bug, Filter, Lightbulb, Rocket, Search, SendHorizonal, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { feedbackModuleLabel } from '@/shared/constants/feedback-app-module';
import { useSupportPageViewModel } from '@/modules/support/view-models/useSupportPageViewModel';

function typeLabel(type: string) {
  switch (type) {
    case 'BUG':
      return 'Bug';
    case 'SUGGESTION':
      return 'Sugestão';
    case 'IMPROVEMENT':
      return 'Melhoria';
    default:
      return type;
  }
}

export default function SupportPage() {
  const vm = useSupportPageViewModel();

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Suporte técnico
          </h1>
          <p className="page-description mt-1">
            Envie bugs, sugestões e melhorias para evoluirmos a operação com mais clareza.
          </p>
        </div>
      </div>

      <div className="card-grid mb-8">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Total enviado</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.summary.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Feedbacks registrados</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Bugs</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.summary.bugs}</p>
            <p className="mt-1 text-xs text-muted-foreground">Problemas reportados</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Sugestões</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.summary.suggestions}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ideias enviadas pelo time</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Melhorias</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.summary.improvements}</p>
            <p className="mt-1 text-xs text-muted-foreground">Refinamentos solicitados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SendHorizonal className="h-4 w-4 text-primary" />
              Novo feedback
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Área atual:{' '}
              <span className="font-semibold text-foreground">{vm.currentAppModule.label}</span>{' '}
              <span className="font-mono text-[10px]">({vm.currentAppModule.code})</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={vm.form.type}
                onValueChange={(value: 'BUG' | 'SUGGESTION' | 'IMPROVEMENT') =>
                  vm.setForm((current) => ({ ...current, type: value }))
                }
              >
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
                value={vm.form.title}
                onChange={(event) =>
                  vm.setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Ex: erro ao gerar cobrança com cliente novo"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={7}
                value={vm.form.description}
                onChange={(event) =>
                  vm.setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Conte o que aconteceu, em qual tela e como reproduzir."
              />
            </div>

            <div className="space-y-2">
              <Label>Caminho da tela</Label>
              <Input
                value={vm.form.pagePath ?? ''}
                onChange={(event) =>
                  vm.setForm((current) => ({ ...current, pagePath: event.target.value }))
                }
                placeholder="Opcional. Ex: /app/sales/payment-links"
              />
            </div>

            <Button
              className="w-full gap-2"
              disabled={vm.createMutation.isPending}
              onClick={() => vm.submitCreate()}
            >
              <SendHorizonal className="h-4 w-4" />
              {vm.createMutation.isPending ? 'Enviando...' : 'Enviar feedback'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="glass-card space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={vm.search}
                  onChange={(event) => vm.setSearch(event.target.value)}
                  placeholder="Buscar por título ou descrição..."
                  className="pl-9"
                />
              </div>
              <Select value={vm.typeFilter} onValueChange={(v: any) => vm.setTypeFilter(v)}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os tipos</SelectItem>
                  <SelectItem value="BUG">Bugs</SelectItem>
                  <SelectItem value="SUGGESTION">Sugestões</SelectItem>
                  <SelectItem value="IMPROVEMENT">Melhorias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="glass-card overflow-hidden">
            <CardContent className="space-y-3 p-5">
              {vm.feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="rounded-2xl border border-border/60 bg-background/50 hover:bg-background/80 transition-colors p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {feedback.type === 'BUG' ? (
                          <Bug className="h-4 w-4 text-rose-500" />
                        ) : feedback.type === 'SUGGESTION' ? (
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Rocket className="h-4 w-4 text-emerald-500" />
                        )}
                        <p className="text-sm font-bold text-foreground">{feedback.title}</p>
                        <Badge variant="secondary">{typeLabel(feedback.type)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{feedback.description}</p>
                      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                        <span className="rounded-full bg-secondary/50 px-3 py-1">
                          {new Date(feedback.createdAt).toLocaleString('pt-BR')}
                        </span>
                        {feedback.pagePath && (
                          <span className="rounded-full bg-secondary/50 px-3 py-1">
                            {feedback.pagePath}
                          </span>
                        )}
                        {feedback.appModule && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary/90">
                            {feedbackModuleLabel(feedback.appModule)}
                          </span>
                        )}
                        <span className="rounded-full bg-secondary/50 px-3 py-1">
                          {feedback.userName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {!vm.feedbacks.length && (
                <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
                  <Wrench className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-bold text-foreground">Nenhum feedback encontrado</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ajuste os filtros ou envie o primeiro feedback usando o formulário ao lado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
