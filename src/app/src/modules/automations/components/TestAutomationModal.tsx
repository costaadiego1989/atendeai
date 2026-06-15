import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  MessageSquare, 
  User,
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Tag,
  X,
} from 'lucide-react';
import { Automation, StepType } from '../types';
import { STEP_LABELS } from '../types';

interface TestData {
  contact: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    tags: string[];
    customFields: Record<string, unknown>;
  };
  environment: 'development' | 'staging';
  variables: Record<string, unknown>;
}

interface TestResult {
  id: string;
  automationId: string;
  status: 'success' | 'failed' | 'running' | 'cancelled';
  duration: number;
  steps: Array<{
    id: string;
    type: StepType;
    status: 'completed' | 'failed' | 'skipped';
    duration: number;
    result?: string;
    error?: string;
    output?: unknown;
  }>;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'error' | 'warn';
    message: string;
    data?: unknown;
  }>;
  startedAt: Date;
  completedAt?: Date;
  testData: TestData;
}

interface TestAutomationModalProps {
  automation: Automation;
  onTestComplete: (results: TestResult) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestEnvironment {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  contactFields: string[];
}

const testEnvironments: TestEnvironment[] = [
  {
    id: 'development',
    name: 'Desenvolvimento',
    description: 'Ambiente isolado com dados de teste',
    icon: Settings,
    contactFields: ['name', 'phone', 'email', 'tags'],
  },
  {
    id: 'staging',
    name: 'Homologação',
    description: 'Ambiente de pré-produção com dados reais',
    icon: Calendar,
    contactFields: ['name', 'phone', 'email', 'tags', 'customFields'],
  },
];

// Mock contact data generator
function generateMockContact(environment: 'development' | 'staging'): TestData['contact'] {
  const mockContacts = [
    { name: 'João Silva', phone: '+55 11 99999-0000', email: 'joao@example.com', tags: ['cliente'] },
    { name: 'Maria Santos', phone: '+55 21 99999-1111', email: 'maria@example.com', tags: ['prospect'] },
    { name: 'Pedro Oliveira', phone: '+55 31 99999-2222', email: 'pedro@example.com', tags: ['vip'] },
    { name: 'Ana Costa', phone: '+55 41 99999-3333', email: 'ana@example.com', tags: ['novo'] },
  ];

  const contact = mockContacts[Math.floor(Math.random() * mockContacts.length)];
  
  return {
    id: `contact-${Date.now()}`,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    tags: contact.tags,
    customFields: environment === 'staging' ? {
      company: 'Empresa Exemplo',
      source: 'website',
      lastPurchase: '2024-01-15',
    } : {},
  };
}

// Mock test execution
async function executeTest(
  automation: Automation, 
  testData: TestData
): Promise<TestResult> {
  const startTime = new Date();
  const steps: TestResult['steps'] = [];
  const logs: TestResult['logs'] = [];

  // Log test start
  logs.push({
    timestamp: startTime,
    level: 'info',
    message: `Iniciando teste da automação: ${automation.name}`,
    data: { automationId: automation.id },
  });

  // Simulate step execution
  for (let i = 0; i < automation.steps.length; i++) {
    const step = automation.steps[i];
    const stepStartTime = new Date();
    
    // Log step start
    logs.push({
      timestamp: stepStartTime,
      level: 'info',
      message: `Executando passo ${i + 1}: ${STEP_LABELS[step.type]}`,
      data: { stepId: step.id, stepType: step.type },
    });

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

    const success = Math.random() > 0.1; // 90% success rate
    const duration = Date.now() - stepStartTime.getTime();

    if (success) {
      steps.push({
        id: step.id || `step-${i}`,
        type: step.type,
        status: 'completed',
        duration,
        result: `Passo concluído com sucesso`,
        output: generateStepOutput(step.type, testData.contact),
      });

      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Passo ${i + 1} concluído em ${duration}ms`,
        data: { stepId: step.id, success: true },
      });
    } else {
      steps.push({
        id: step.id || `step-${i}`,
        type: step.type,
        status: 'failed',
        duration,
        error: `Erro na execução do passo: ${STEP_LABELS[step.type]}`,
      });

      logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Passo ${i + 1} falhou após ${duration}ms`,
        data: { stepId: step.id, success: false, error: 'Erro simulado' },
      });
    }
  }

  const endTime = new Date();
  const totalDuration = endTime.getTime() - startTime.getTime();

  logs.push({
    timestamp: endTime,
    level: 'info',
    message: `Teste concluído em ${totalDuration}ms`,
    data: { 
      totalSteps: steps.length,
      success: steps.every(s => s.status === 'completed'),
    },
  });

  return {
    id: `test-${Date.now()}`,
    automationId: automation.id,
    status: steps.every(s => s.status === 'completed') ? 'success' : 'failed',
    duration: totalDuration,
    steps,
    logs,
    startedAt: startTime,
    completedAt: endTime,
    testData,
  };
}

function generateStepOutput(stepType: StepType, contact: TestData['contact']): unknown {
  switch (stepType) {
    case StepType.SEND_MESSAGE:
      return {
        messageId: `msg-${Date.now()}`,
        channel: 'whatsapp',
        sentTo: contact.phone,
        content: `Mensagem enviada para ${contact.name}`,
        timestamp: new Date(),
      };
    
    case StepType.ADD_TAG:
      return {
        tagAdded: 'test-tag',
        contactId: contact.id,
        timestamp: new Date(),
      };
    
    case StepType.REMOVE_TAG:
      return {
        tagRemoved: 'old-tag',
        contactId: contact.id,
        timestamp: new Date(),
      };
    
    case StepType.WAIT_DELAY:
      return {
        delayCompleted: true,
        delayDuration: '1h',
        timestamp: new Date(),
      };
    
    case StepType.CREATE_TASK:
      return {
        taskId: `task-${Date.now()}`,
        title: 'Tarefa criada',
        assignedTo: 'agent-1',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timestamp: new Date(),
      };
    
    default:
      return {
        executed: true,
        timestamp: new Date(),
      };
  }
}

export function TestAutomationModal({
  automation,
  onTestComplete,
  isOpen,
  onOpenChange,
}: TestAutomationModalProps) {
  const [testData, setTestData] = useState<TestData>({
    contact: generateMockContact('development'),
    environment: 'development',
    variables: {},
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<TestEnvironment>(testEnvironments[0]);

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      const result = await executeTest(automation, testData);
      setTestResult(result);
      onTestComplete(result);
    } catch (error) {
      console.error('Test failed:', error);
      const errorResult: TestResult = {
        id: `test-error-${Date.now()}`,
        automationId: automation.id,
        status: 'failed',
        duration: 0,
        steps: [],
        logs: [
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Falha na execução do teste',
            data: { error: error instanceof Error ? error.message : 'Unknown error' },
          },
        ],
        startedAt: new Date(),
        completedAt: new Date(),
        testData,
      };
      setTestResult(errorResult);
      onTestComplete(errorResult);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEnvironmentChange = (environmentId: string) => {
    const environment = testEnvironments.find(e => e.id === environmentId);
    if (environment) {
      setSelectedEnvironment(environment);
      setTestData(prev => ({
        ...prev,
        environment: environmentId as 'development' | 'staging',
        contact: generateMockContact(environmentId as 'development' | 'staging'),
      }));
    }
  };

  const handleContactFieldChange = (field: keyof TestData['contact'], value: string | string[]) => {
    setTestData(prev => ({
      ...prev,
      contact: {
        ...prev.contact,
        [field]: value,
      },
    }));
  };

  const handleVariableChange = (key: string, value: string) => {
    setTestData(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [key]: value,
      },
    }));
  };

  const generateNewContact = () => {
    setTestData(prev => ({
      ...prev,
      contact: generateMockContact(prev.environment),
    }));
  };

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Testar Automação: {automation.name}
                </CardTitle>
                <CardDescription>
                  Execute esta automação com dados de teste para validar seu comportamento
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Test Configuration */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Configuração do Teste</h3>
                  
                  {/* Environment Selection */}
                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium">Ambiente</label>
                    <div className="grid gap-2">
                      {testEnvironments.map((env) => (
                        <Card 
                          key={env.id}
                          className={`cursor-pointer transition-colors ${
                            selectedEnvironment.id === env.id 
                              ? 'ring-2 ring-primary' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleEnvironmentChange(env.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <env.icon className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{env.name}</p>
                                <p className="text-xs text-muted-foreground">{env.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Contact Data */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Dados do Contato</label>
                      <Button variant="outline" size="sm" onClick={generateNewContact}>
                        Gerar novo contato
                      </Button>
                    </div>

                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Nome</label>
                            <Input
                              value={testData.contact.name}
                              onChange={(e) => handleContactFieldChange('name', e.target.value)}
                              disabled
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Telefone</label>
                            <Input
                              value={testData.contact.phone}
                              onChange={(e) => handleContactFieldChange('phone', e.target.value)}
                              disabled
                            />
                          </div>
                        </div>

                        {testData.contact.email && (
                          <div>
                            <label className="text-xs text-muted-foreground">Email</label>
                            <Input
                              value={testData.contact.email as string}
                              onChange={(e) => handleContactFieldChange('email', e.target.value)}
                              disabled
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-muted-foreground">Tags</label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {testData.contact.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {selectedEnvironment.id === 'staging' && Object.keys(testData.contact.customFields).length > 0 && (
                          <div>
                            <label className="text-xs text-muted-foreground">Campos Customizados</label>
                            <div className="mt-2 space-y-1">
                              {Object.entries(testData.contact.customFields).map(([key, value]) => (
                                <div key={key} className="text-xs bg-muted p-2 rounded">
                                  <span className="font-medium">{key}:</span> {String(value)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Variables */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Variáveis Personalizadas</label>
                    <div className="space-y-2">
                      {Object.entries(testData.variables).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            placeholder="Nome da variável"
                            value={key}
                            onChange={(e) => {
                              const newVariables = { ...testData.variables };
                              delete newVariables[key];
                              if (e.target.value) {
                                newVariables[e.target.value] = value;
                              }
                              setTestData({ ...testData, variables: newVariables });
                            }}
                          />
                          <Input
                            placeholder="Valor"
                            value={String(value)}
                            onChange={(e) => handleVariableChange(key, e.target.value)}
                          />
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newKey = `var${Object.keys(testData.variables).length + 1}`;
                          setTestData({
                            ...testData,
                            variables: { ...testData.variables, [newKey]: '' },
                          });
                        }}
                      >
                        Adicionar variável
                      </Button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={handleRunTest}
                    disabled={isRunning}
                    className="w-full gap-1.5"
                    size="lg"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Executando teste...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Executar Teste
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Test Results */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Resultados do Teste</h3>

                {isRunning && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-center text-muted-foreground">
                          Executando automação com dados de teste...
                        </p>
                        <div className="w-full max-w-xs">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {testResult && (
                  <div className="space-y-4">
                    {/* Test Summary */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {testResult.status === 'success' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-semibold">
                              {testResult.status === 'success' ? 'Teste Bem-sucedido' : 'Teste Falhou'}
                            </span>
                          </div>
                          <Badge variant={testResult.status === 'success' ? 'default' : 'destructive'}>
                            {testResult.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold">{testResult.steps.length}</p>
                            <p className="text-xs text-muted-foreground">Passos</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{(testResult.duration / 1000).toFixed(1)}s</p>
                            <p className="text-xs text-muted-foreground">Duração</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">
                              {testResult.steps.filter(s => s.status === 'completed').length}
                            </p>
                            <p className="text-xs text-muted-foreground">Sucesso</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Step Results */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Execução dos Passos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {testResult.steps.map((step, index) => (
                              <div key={step.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    step.status === 'completed' ? 'bg-green-500' : 
                                    step.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                  }`} />
                                  <span className="text-sm font-medium">
                                    {index + 1}. {STEP_LABELS[step.type]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {(step.duration / 1000).toFixed(2)}s
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {step.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Logs */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Logs da Execução</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-2 text-xs font-mono">
                            {testResult.logs.map((log, index) => (
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
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}