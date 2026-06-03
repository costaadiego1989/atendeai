import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  MessageSquare, 
  Zap, 
  Clock, 
  Tag, 
  Target,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Search,
  Filter,
  Play,
  BarChart3,
  Users,
  ShoppingCart,
  Calendar,
  Globe,
  Bot,
  FileText,
} from 'lucide-react';
import { TriggerType, StepType } from '../types';
import { TRIGGER_LABELS, STEP_LABELS } from '../types';

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Começando',
    description: 'Noções básicas sobre automações',
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold">O que são automações?</h4>
          <p className="text-sm text-muted-foreground">
            Automações são regras que executam ações automaticamente quando certos eventos ocorrem. 
            Elas ajudam a economizar tempo, garantir consistência e reduzir erros manuais.
          </p>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-semibold">Componentes básicos</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <strong>Gatilho:</strong> O evento que dispara a automação
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <strong>Passos:</strong> As ações que serão executadas
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <strong>Condições:</strong> Regras opcionais para execução
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Dica inicial</p>
              <p>Comece com automações simples como boas-vindas e vá aumentando a complexidade conforme ganha confiança.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'triggers',
    title: 'Gatilhos Disponíveis',
    description: 'Quando suas automações serão executadas',
    icon: Zap,
    content: (
      <div className="space-y-4">
        {Object.values(TriggerType).map((type) => (
          <div key={type} className="border border-border/60 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{TRIGGER_LABELS[type]}</h4>
                <Badge variant="outline" className="text-xs">
                  {getTriggerDifficulty(type)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {getTriggerDescription(type)}
            </p>
            <div className="bg-muted/50 rounded p-2 text-xs">
              <p className="font-medium mb-1">Exemplo de uso:</p>
              <p>{getTriggerExample(type)}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'steps',
    title: 'Passos Disponíveis',
    description: 'Ações que suas automações podem executar',
    icon: Play,
    content: (
      <div className="space-y-4">
        {Object.values(StepType).map((type) => (
          <div key={type} className="border border-border/60 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{STEP_LABELS[type]}</h4>
                <Badge variant="outline" className="text-xs">
                  {getStepDifficulty(type)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {getStepDescription(type)}
            </p>
            {getStepConfig(type) && (
              <div className="bg-muted/50 rounded p-2 text-xs">
                <p className="font-medium mb-1">Configuração:</p>
                <p>{getStepConfig(type)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'Modelos prontos para uso rápido',
    icon: FileText,
    content: (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-border/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold">Sequência de Boas-Vindas</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Mensagens automáticas para novos contatos
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Iniciante</Badge>
              <span>5 minutos</span>
            </div>
          </div>

          <div className="border border-border/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <h4 className="font-semibold">Lembrete de Pagamento</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Notificações sobre pagamentos vencidos
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Intermediário</Badge>
              <span>10 minutos</span>
            </div>
          </div>

          <div className="border border-border/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold">Recuperação de Carrinho</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Reativa clientes que abandonaram o carrinho
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Avançado</Badge>
              <span>15 minutos</span>
            </div>
          </div>

          <div className="border border-border/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold">Agendamentos</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Lembretes e confirmação de agendamentos
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Intermediário</Badge>
              <span>12 minutos</span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Benefícios dos templates</p>
              <p>Economize tempo com modelos testados e otimizados. Basta adaptar às suas necessidades.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'best-practices',
    title: 'Melhores Práticas',
    description: 'Dicas para automações eficazes',
    icon: Lightbulb,
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Nomes descritivos</h4>
              <p className="text-sm text-muted-foreground">
                Use nomes claros como "Boas-vindas novos clientes" em vez de "Automação 1"
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Teste antes de ativar</h4>
              <p className="text-sm text-muted-foreground">
                Use o ambiente de teste para validar sua automação antes de colocar em produção
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Evite loops infinitos</h4>
              <p className="text-sm text-muted-foreground">
                Crie condições para que automações não disparem continuamente
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Use tags para organização</h4>
              <p className="text-sm text-muted-foreground">
                Marque suas automações com tags como "marketing", "vendas", "suporte"
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Cuidado</p>
              <p>Automações mal configuradas podem causar problemas. Sempre teste em ambiente de desenvolvimento primeiro.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

function getTriggerDifficulty(type: TriggerType): string {
  const difficulties = {
    [TriggerType.CONTACT_CREATED]: 'Fácil',
    [TriggerType.TAG_ADDED]: 'Fácil',
    [TriggerType.MESSAGE_RECEIVED]: 'Fácil',
    [TriggerType.PAYMENT_OVERDUE]: 'Médio',
    [TriggerType.APPOINTMENT_CONFIRMED]: 'Médio',
    [TriggerType.APPOINTMENT_REMINDER]: 'Médio',
    [TriggerType.ORDER_PLACED]: 'Médio',
    [TriggerType.CART_ABANDONED]: 'Avançado',
    [TriggerType.WEBHOOK_RECEIVED]: 'Avançado',
    [TriggerType.SCHEDULED]: 'Avançado',
  };
  return difficulties[type] || '';
}

function getTriggerDescription(type: TriggerType): string {
  const descriptions = {
    [TriggerType.CONTACT_CREATED]: 'Quando um novo contato é criado no CRM',
    [TriggerType.TAG_ADDED]: 'Quando uma tag é adicionada a um contato',
    [TriggerType.MESSAGE_RECEIVED]: 'Quando uma mensagem é recebida',
    [TriggerType.PAYMENT_OVERDUE]: 'Quando um pagamento fica vencido',
    [TriggerType.APPOINTMENT_CONFIRMED]: 'Quando um agendamento é confirmado',
    [TriggerType.APPOINTMENT_REMINDER]: 'Quando é hora de um lembrete de agendamento',
    [TriggerType.ORDER_PLACED]: 'Quando um pedido é realizado',
    [TriggerType.CART_ABANDONED]: 'Quando um cliente abandona o carrinho',
    [TriggerType.WEBHOOK_RECEIVED]: 'Quando um webhook é recebido',
    [TriggerType.SCHEDULED]: 'Executado em horário agendado (cron)',
  };
  return descriptions[type] || '';
}

function getTriggerExample(type: TriggerType): string {
  const examples = {
    [TriggerType.CONTACT_CREATED]: 'Envie uma mensagem de boas-vindas quando um novo cliente se cadastra',
    [TriggerType.TAG_ADDED]: 'Adicione um lead à lista de nutrição quando a tag "interessado" for adicionada',
    [TriggerType.MESSAGE_RECEIVED]: 'Responda automaticamente mensagens recebidas fora do horário comercial',
    [TriggerType.PAYMENT_OVERDUE]: 'Envie lembretes de pagamento quando faturas vencem',
    [TriggerType.SCHEDULED]: 'Envia relatórios diários às 9h da manhã',
  };
  return examples[type] || '';
}

function getStepDifficulty(type: StepType): string {
  const difficulties = {
    [StepType.SEND_MESSAGE]: 'Fácil',
    [StepType.WAIT_DELAY]: 'Fácil',
    [StepType.ADD_TAG]: 'Fácil',
    [StepType.REMOVE_TAG]: 'Fácil',
    [StepType.CONDITION_BRANCH]: 'Médio',
    [StepType.HTTP_REQUEST]: 'Avançado',
    [StepType.UPDATE_CONTACT]: 'Médio',
    [StepType.ASSIGN_AGENT]: 'Médio',
    [StepType.AI_RESPONSE]: 'Avançado',
    [StepType.CREATE_TASK]: 'Médio',
  };
  return difficulties[type] || '';
}

function getStepDescription(type: StepType): string {
  const descriptions = {
    [StepType.SEND_MESSAGE]: 'Envia mensagens para o cliente via WhatsApp, Instagram ou Web Chat',
    [StepType.WAIT_DELAY]: 'Aguarda um período de tempo antes de continuar a execução',
    [StepType.CONDITION_BRANCH]: 'Executa diferentes ações baseado em condições',
    [StepType.HTTP_REQUEST]: 'Faz requisições para APIs externas',
    [StepType.UPDATE_CONTACT]: 'Atualiza informações do contato no CRM',
    [StepType.ADD_TAG]: 'Adiciona tags ao contato para segmentação',
    [StepType.REMOVE_TAG]: 'Remove tags do contato',
    [StepType.ASSIGN_AGENT]: 'Atribui o contato a um agente específico',
    [StepType.AI_RESPONSE]: 'Gera respostas usando inteligência artificial',
    [StepType.CREATE_TASK]: 'Cria tarefas para a equipe de atendimento',
  };
  return descriptions[type] || '';
}

function getStepConfig(type: StepType): string | null {
  const configs = {
    [StepType.SEND_MESSAGE]: 'Configure canal, mensagem e variáveis dinâmicas',
    [StepType.WAIT_DELAY]: 'Defina tempo em minutos, horas ou dias',
    [StepType.CONDITION_BRANCH]: 'Configure campo, operador e valor',
    [StepType.HTTP_REQUEST]: 'Configure método, URL, headers e body',
    [StepType.UPDATE_CONTACT]: 'Selecione campos para atualizar',
    [StepType.ADD_TAG]: 'Informe o nome da tag',
    [StepType.REMOVE_TAG]: 'Informe o nome da tag',
    [StepType.ASSIGN_AGENT]: 'Informe o ID do agente',
    [StepType.CREATE_TASK]: 'Configure título, descrição e prazo',
  };
  return configs[type] || null;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = helpSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Centro de Ajuda - Automações
          </DialogTitle>
          <DialogDescription>
            Aprenda como criar e gerenciar automações poderosas
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ajuda..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-4 h-[calc(90vh-200px)]">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <ScrollArea className="h-full">
              <div className="space-y-1">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">{section.title}</p>
                        <p className="text-xs opacity-70">{section.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content */}
          <div className="flex-1">
            <ScrollArea className="h-full">
              {filteredSections
                .find(section => section.id === activeSection)
                ?.content || (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Seção não encontrada</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}