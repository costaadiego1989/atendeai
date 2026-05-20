import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import type { VoiceCall } from '../services/voice-service';

interface VoiceCallsHistoryProps {
  calls: VoiceCall[];
  isLoading: boolean;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'Concluída', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  IN_PROGRESS: { label: 'Em andamento', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  INITIATED: { label: 'Iniciada', className: 'bg-gray-100 text-gray-800' },
  RINGING: { label: 'Chamando', className: 'bg-amber-100 text-amber-800' },
  FAILED: { label: 'Falhou', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  NO_ANSWER: { label: 'Sem resposta', className: 'bg-gray-100 text-gray-600' },
};

const RESULT_MAP: Record<string, { label: string; className: string }> = {
  AGREEMENT: { label: 'Acordo', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  REFUSED: { label: 'Recusou', className: 'bg-red-100 text-red-800' },
  CALLBACK: { label: 'Retornar', className: 'bg-amber-100 text-amber-800' },
  NO_ANSWER: { label: 'Sem resposta', className: 'bg-gray-100 text-gray-600' },
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VoiceCallsHistory({ calls, isLoading }: VoiceCallsHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Carregando chamadas...</p>
      </div>
    );
  }

  if (!calls.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Phone className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma chamada registrada.</p>
        <p className="text-xs text-muted-foreground mt-1">
          As chamadas aparecerão aqui quando o agente de voz estiver ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border/60">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Contato</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Direção</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Resultado</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Duração</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Data</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const status = STATUS_MAP[call.status] ?? STATUS_MAP.INITIATED;
            const result = call.result ? RESULT_MAP[call.result] : null;

            return (
              <tr key={call.id} className="border-b border-border/40 hover:bg-muted/10">
                <td className="px-4 py-2.5 text-xs font-medium text-foreground">
                  {call.contactName || call.contactId.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5">
                  {call.direction === 'OUTBOUND' ? (
                    <PhoneOutgoing className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <PhoneIncoming className="h-3.5 w-3.5 text-green-600" />
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="secondary" className={`text-[10px] ${status.className}`}>
                    {status.label}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  {result ? (
                    <Badge variant="secondary" className={`text-[10px] ${result.className}`}>
                      {result.label}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDuration(call.duration)}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-green-700">
                  {call.amountRecovered
                    ? `R$ ${call.amountRecovered.toLocaleString('pt-BR')}`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(call.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
