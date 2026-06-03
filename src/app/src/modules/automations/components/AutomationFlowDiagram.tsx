import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  MessageSquare,
  Clock,
  Tag,
  User,
  Bot,
  ArrowRight,
  ArrowLeftRight,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { StepType, TriggerType } from '../types';
import { STEP_LABELS, TRIGGER_LABELS } from '../types';

interface FlowNode {
  id: string;
  type: 'trigger' | 'step' | 'condition';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    type: string;
    config?: Record<string, unknown>;
    status?: 'pending' | 'running' | 'completed' | 'error';
    order?: number;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type: 'smoothstep' | 'straight';
  markerEnd?: MarkerType;
  animated?: boolean;
  data?: {
    label?: string;
  };
}

interface AutomationFlowDiagramProps {
  automation: any;
  onNodeClick?: (node: FlowNode) => void;
  interactive?: boolean;
  onStepChange?: (steps: any[]) => void;
  showMetrics?: boolean;
}

interface TestResults {
  id: string;
  automationId: string;
  status: 'success' | 'failed' | 'running';
  duration: number;
  steps: Array<{
    id: string;
    type: string;
    status: 'completed' | 'failed' | 'skipped';
    duration: number;
    result?: string;
    error?: string;
  }>;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'error' | 'warn';
    message: string;
    data?: any;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

// Node types configuration
const nodeTypes: NodeTypes = {
  trigger: ({ data }) => (
    <div className="px-4 py-3 bg-blue-100 border-2 border-blue-300 rounded-lg shadow-sm min-w-[150px]">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-900">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs text-blue-700">{data.description}</p>
      )}
      {data.status && (
        <div className="mt-2">
          <StatusBadge status={data.status} />
        </div>
      )}
    </div>
  ),
  step: ({ data }) => (
    <div className="px-4 py-3 bg-green-100 border-2 border-green-300 rounded-lg shadow-sm min-w-[150px]">
      <div className="flex items-center gap-2 mb-1">
        <Play className="h-4 w-4 text-green-600" />
        <span className="text-sm font-semibold text-green-900">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs text-green-700">{data.description}</p>
      )}
      {data.status && (
        <div className="mt-2">
          <StatusBadge status={data.status} />
        </div>
      )}
    </div>
  ),
  condition: ({ data }) => (
    <div className="px-4 py-3 bg-purple-100 border-2 border-purple-300 rounded-lg shadow-sm min-w-[150px]">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-semibold text-purple-900">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs text-purple-700">{data.description}</p>
      )}
      {data.status && (
        <div className="mt-2">
          <StatusBadge status={data.status} />
        </div>
      )}
    </div>
  ),
};

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants = {
    pending: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    skipped: 'bg-yellow-100 text-yellow-700',
  };

  const labels = {
    pending: 'Pendente',
    running: 'Executando',
    completed: 'Concluído',
    error: 'Erro',
    skipped: 'Ignorado',
  };

  return (
    <Badge variant="outline" className={`text-xs ${variants[status as keyof typeof variants] || variants.pending}`}>
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
}

// Convert automation to flow nodes and edges
function convertAutomationToFlow(automation: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Add trigger node
  if (automation.trigger) {
    nodes.push({
      id: `trigger-${automation.id}`,
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        label: TRIGGER_LABELS[automation.trigger.type],
        description: getTriggerDescription(automation.trigger.type),
        type: automation.trigger.type,
        config: automation.trigger.config,
        order: 0,
      },
    });
  }

  // Add step nodes
  automation.steps?.forEach((step: any, index: number) => {
    const nodeId = `step-${step.id || index}`;
    nodes.push({
      id: nodeId,
      type: step.type === StepType.CONDITION_BRANCH ? 'condition' : 'step',
      position: { x: 250 + (index % 3) * 200, y: 150 + Math.floor(index / 3) * 120 },
      data: {
        label: STEP_LABELS[step.type],
        description: getStepDescription(step.type),
        type: step.type,
        config: step.config,
        order: index + 1,
      },
    });

    // Add edge from trigger to first step
    if (index === 0 && automation.trigger) {
      edges.push({
        id: `edge-trigger-${nodeId}`,
        source: `trigger-${automation.id}`,
        target: nodeId,
        type: 'smoothstep',
        markerEnd: MarkerType.ArrowClosed,
      });
    }

    // Add edge between steps
    if (index > 0) {
      const prevNodeId = `step-${automation.steps[index - 1].id || index - 1}`;
      edges.push({
        id: `edge-${prevNodeId}-${nodeId}`,
        source: prevNodeId,
        target: nodeId,
        type: 'smoothstep',
        markerEnd: MarkerType.ArrowClosed,
      });
    }
  });

  return { nodes, edges };
}

function getTriggerDescription(type: TriggerType): string {
  const descriptions = {
    [TriggerType.CONTACT_CREATED]: 'Novo contato criado',
    [TriggerType.TAG_ADDED]: 'Tag adicionada',
    [TriggerType.MESSAGE_RECEIVED]: 'Mensagem recebida',
    [TriggerType.PAYMENT_OVERDUE]: 'Pagamento vencido',
    [TriggerType.APPOINTMENT_CONFIRMED]: 'Agendamento confirmado',
    [TriggerType.APPOINTMENT_REMINDER]: 'Lembrete de agendamento',
    [TriggerType.ORDER_PLACED]: 'Pedido realizado',
    [TriggerType.CART_ABANDONED]: 'Carrinho abandonado',
    [TriggerType.WEBHOOK_RECEIVED]: 'Webhook recebido',
    [TriggerType.SCHEDULED]: 'Execução agendada',
  };
  return descriptions[type] || '';
}

function getStepDescription(type: StepType): string {
  const descriptions = {
    [StepType.SEND_MESSAGE]: 'Enviar mensagem para cliente',
    [StepType.WAIT_DELAY]: 'Aguardar período de tempo',
    [StepType.CONDITION_BRANCH]: 'Verificar condição',
    [StepType.HTTP_REQUEST]: 'Fazer requisição HTTP',
    [StepType.UPDATE_CONTACT]: 'Atualizar informações',
    [StepType.ADD_TAG]: 'Adicionar tag ao contato',
    [StepType.REMOVE_TAG]: 'Remover tag do contato',
    [StepType.ASSIGN_AGENT]: 'Atribuir agente',
    [StepType.AI_RESPONSE]: 'Gerar resposta IA',
    [StepType.CREATE_TASK]: 'Criar tarefa',
  };
  return descriptions[type] || '';
}

export function AutomationFlowDiagram({
  automation,
  onNodeClick,
  interactive = true,
  onStepChange,
  showMetrics = true,
}: AutomationFlowDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);

  // Convert automation to flow when it changes
  useEffect(() => {
    if (automation) {
      const { nodes: flowNodes, edges: flowEdges } = convertAutomationToFlow(automation);
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [automation, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!interactive) return;
      
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: 'smoothstep',
        markerEnd: MarkerType.ArrowClosed,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [interactive, setEdges]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      onNodeClick?.(node as FlowNode);
    },
    [onNodeClick]
  );

  const runSimulation = async () => {
    if (!automation || isSimulating) return;

    setIsSimulating(true);
    setTestResults(null);

    // Simulate execution
    const mockResults: TestResults = {
      id: `test-${Date.now()}`,
      automationId: automation.id,
      status: 'running',
      duration: 0,
      steps: [],
      logs: [],
      startedAt: new Date(),
    };

    // Update node statuses progressively
    const updatedNodes = nodes.map((node, index) => {
      const step = automation.steps[index];
      if (step) {
        return {
          ...node,
          data: {
            ...node.data,
            status: index === 0 ? 'running' : 'pending',
          },
        };
      }
      return node;
    });

    setNodes(updatedNodes);

    // Simulate step execution
    for (let i = 0; i < automation.steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const step = automation.steps[i];
      const success = Math.random() > 0.1; // 90% success rate

      const updatedNodesAgain = nodes.map((node, index) => {
        if (index === i) {
          return {
            ...node,
            data: {
              ...node.data,
              status: success ? 'completed' : 'error',
            },
          };
        }
        return node;
      });

      setNodes(updatedNodesAgain);

      mockResults.steps.push({
        id: step.id || `step-${i}`,
        type: step.type,
        status: success ? 'completed' : 'failed',
        duration: 500 + Math.random() * 1500,
        result: success ? 'Executado com sucesso' : 'Falha na execução',
        error: success ? undefined : new Error('Erro simulado na execução'),
      });

      mockResults.logs.push({
        timestamp: new Date(),
        level: success ? 'info' : 'error',
        message: success 
          ? `Passo ${i + 1} (${STEP_LABELS[step.type]}) concluído com sucesso`
          : `Passo ${i + 1} (${STEP_LABELS[step.type]}) falhou`,
        data: step,
      });
    }

    mockResults.status = 'success';
    mockResults.duration = mockResults.steps.reduce((sum, step) => sum + step.duration, 0);
    mockResults.completedAt = new Date();

    setTestResults(mockResults);
    setIsSimulating(false);

    // Reset node statuses after simulation
    setTimeout(() => {
      setNodes(nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          status: undefined,
        },
      })));
    }, 3000);
  };

  const resetSimulation = () => {
    setNodes(nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        status: undefined,
      },
    })));
    setTestResults(null);
    setIsSimulating(false);
  };

  if (!automation) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Selecione uma automação para visualizar o fluxo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runSimulation}
            disabled={isSimulating}
            className="gap-1.5"
          >
            {isSimulating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isSimulating ? 'Executando...' : 'Testar Fluxo'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetSimulation}
            disabled={isSimulating}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Flow Diagram */}
      <Card>
        <CardContent className="p-4">
          <div className="h-[500px] w-full border border-border/60 rounded-lg overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={interactive ? handleNodeClick : undefined}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResults.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Resultados do Teste
            </CardTitle>
            <CardDescription>
              Duração total: {(testResults.duration / 1000).toFixed(2)}s | 
              Passos: {testResults.steps.length} | 
              Status: {testResults.status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Step Results */}
              <div>
                <h4 className="font-semibold mb-2">Execução dos Passos</h4>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {testResults.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={step.status} />
                          <span className="text-sm font-medium">
                            Passo {index + 1}: {STEP_LABELS[step.type as StepType]}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(step.duration / 1000).toFixed(2)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Logs */}
              <div>
                <h4 className="font-semibold mb-2">Logs da Execução</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-1 text-xs">
                    {testResults.logs.map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge 
                          variant={log.level === 'error' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-foreground">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalhes do {selectedNode.data.type === 'trigger' ? 'Gatilho' : 'Passo'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Nome:</span>
                <p className="text-sm text-muted-foreground">{selectedNode.data.label}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Descrição:</span>
                <p className="text-sm text-muted-foreground">{selectedNode.data.description}</p>
              </div>
              {selectedNode.data.config && (
                <div>
                  <span className="text-sm font-medium">Configuração:</span>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedNode.data.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}