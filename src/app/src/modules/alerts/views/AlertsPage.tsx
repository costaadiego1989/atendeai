import { Bell, Clock3, PauseCircle, PlayCircle, Send, Trash2, Search, Filter } from 'lucide-react';
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
import { useAlertsPageViewModel, DEFAULT_FORM } from '@/modules/alerts/view-models/useAlertsPageViewModel';
import { AlertsHeader } from '../components/AlertsHeader';
import { AlertsKPIs } from '../components/AlertsKPIs';

function statusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Ativo';
    case 'PAUSED':
      return 'Pausado';
    case 'SENT':
      return 'Enviado';
    default:
      return status;
  }
}

export default function AlertsPage() {
  const vm = useAlertsPageViewModel();

  return (
    <div className="page-container animate-fade-in space-y-6">
      <AlertsHeader />

      <AlertsKPIs
        resolvedPhone={vm.resolvedPhone}
        activeCount={vm.summary.active}
        pausedCount={vm.summary.paused}
        sentCount={vm.summary.sent}
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Novo lembrete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do alerta</Label>
              <Input
                value={vm.form.title}
                onChange={(event) =>
                  vm.setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Ex: ligar para fornecedor as 14h"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                rows={5}
                value={vm.form.message}
                onChange={(event) =>
                  vm.setForm((current) => ({ ...current, message: event.target.value }))
                }
                placeholder="Explique o que precisa lembrar quando o alerta chegar."
              />
            </div>

            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={vm.form.frequency}
                onValueChange={(value: 'ONCE' | 'DAILY') =>
                  vm.setForm((current) => ({ ...current, frequency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONCE">Uma vez</SelectItem>
                  <SelectItem value="DAILY">Todos os dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vm.form.frequency === 'ONCE' ? (
              <div className="space-y-2">
                <Label>Data e horário</Label>
                <Input
                  type="datetime-local"
                  value={vm.form.scheduledAt ?? ''}
                  onChange={(event) =>
                    vm.setForm((current) => ({
                      ...current,
                      scheduledAt: event.target.value,
                    }))
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>horário diario</Label>
                <Input
                  type="time"
                  value={vm.form.timeOfDay ?? '09:00'}
                  onChange={(event) =>
                    vm.setForm((current) => ({
                      ...current,
                      timeOfDay: event.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-sm text-muted-foreground">
              O sistema envia esse lembrete para o seu contato interno e reaproveita a infraestrutura de mensagens ja conectada.
            </div>

            <Button
              className="w-full gap-2"
              disabled={vm.createMutation.isPending || !vm.resolvedPhone}
              onClick={() => vm.submitCreate()}
            >
              <Clock3 className="h-4 w-4" />
              {vm.createMutation.isPending ? 'Agendando...' : 'Criar alerta'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {vm.reminders && (
                <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
                  <span className="font-bold text-foreground mr-1.5">{vm.reminders.length}</span>
                  <span className="font-normal text-muted-foreground">{vm.reminders.length === 1 ? 'alerta' : 'alertas'}</span>
                </Badge>
              )}

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar lembretes por título ou mensagem..."
                  className="pl-9"
                  value={vm.search}
                  onChange={(event) => vm.setSearch(event.target.value)}
                />
              </div>

              <Select value={vm.statusFilter} onValueChange={(v: any) => vm.setStatusFilter(v)}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="PAUSED">Pausados</SelectItem>
                  <SelectItem value="SENT">Enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-widest text-muted-foreground font-bold">Agenda de alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vm.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="rounded-2xl border border-border/60 bg-background/50 hover:bg-background/80 transition-colors p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{reminder.title}</p>
                        <Badge variant={reminder.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {statusLabel(reminder.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{reminder.message}</p>
                      <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                        <span className="rounded-full bg-secondary/50 px-3 py-1">
                          {reminder.frequency === 'ONCE' ? 'Disparo Único' : 'Recorrência Diária'}
                        </span>
                        {reminder.nextTriggerAt && (
                          <span className="rounded-full bg-primary/5 px-3 py-1 text-primary">
                            Próximo: {new Date(reminder.nextTriggerAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                        {reminder.lastTriggeredAt && (
                          <span className="rounded-full bg-secondary px-3 py-1">
                            Último envio: {new Date(reminder.lastTriggeredAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {reminder.status !== 'SENT' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            vm.toggleReminder(reminder.id, reminder.status === 'ACTIVE')
                          }
                        >
                          {reminder.status === 'ACTIVE' ? (
                            <>
                              <PauseCircle className="h-4 w-4" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-4 w-4" />
                              Retomar
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => vm.removeReminder(reminder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {!vm.reminders.length && (
                <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
                  <Send className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-bold text-foreground">Nenhum alerta disponível</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Ajuste os filtros ou crie um novo lembrete para gerenciar sua agenda.
                  </p>
                  <Button variant="outline" onClick={() => vm.setForm(DEFAULT_FORM)}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
