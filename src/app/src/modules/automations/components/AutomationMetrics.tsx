import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Users,
  Target,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Automation, TriggerType, StepType } from '../types';
import { TRIGGER_LABELS, STEP_LABELS } from '../types';

interface AutomationMetrics {
  // Basic metrics
  total: number;
  active: number;
  inactive: number;
  
  // Performance metrics
  averageCreationTime: number; // in minutes
  successRate: number; // percentage
  averageExecutionTime: number; // in seconds
  
  // Usage metrics
  mostUsedTriggerType: TriggerType;
  mostUsedStepType: StepType;
  averageStepsPerAutomation: number;
  
  // Time-based metrics
  automationsCreatedToday: number;
  automationsUpdatedToday: number;
  averageTimeBetweenExecutions: number; // in hours
  
  // Health metrics
  errorRate: number; // percentage
  automationsWithIssues: number;
  
  // Recent activity
  recentExecutions: Array<{
    id: string;
    automationName: string;
    status: 'success' | 'failed';
    duration: number;
    timestamp: Date;
  }>;
}

interface AutomationMetricsProps {
  automation: Automation;
  refreshInterval?: number; // in seconds
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

function MetricCard({ 
  title, 
  value, 
  description, 
  trend, 
  icon: Icon, 
  variant = 'default' 
}: MetricCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600',
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    stable: RefreshCw,
  };

  const TrendIcon = trend ? trendIcons[trend] : null;

  const badgeVariants = {
    default: 'secondary',
    success: 'default',
    warning: 'outline',
    destructive: 'destructive',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Icon className="h-8 w-8 text-muted-foreground" />
            {trend && (
              <div className="flex items-center gap-1">
                {TrendIcon && <TrendIcon className={`h-3 w-3 ${trendColors[trend]}`} />}
                <span className={`text-xs ${trendColors[trend]}`}>
                  {trend === 'up' ? '+12%' : trend === 'down' ? '-8%' : '0%'}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthIndicator({ metrics }: { metrics: AutomationMetrics }) {
  const healthScore = Math.max(0, 100 - 
    (metrics.errorRate * 2) + 
    (metrics.automationsWithIssues * 5) -
    (metrics.successRate * 0.5)
  );

  const healthStatus = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warning' : 'critical';
  const healthColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
  };

  const healthLabels = {
    good: 'Saudável',
    warning: 'Atenção',
    critical: 'Crítico',
  };

  return (
    <Card className={`${healthColors[healthStatus]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Saúde da Automação</h4>
            <p className="text-sm text-muted-foreground">
              {healthLabels[healthStatus]} • {healthScore.toFixed(0)}/100
            </p>
          </div>
          <div className="flex items-center gap-2">
            {healthStatus === 'good' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {healthStatus === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
            {healthStatus === 'critical' && <AlertCircle className="h-5 w-5 text-red-600" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceChart({ metrics }: { metrics: AutomationMetrics }) {
  // Mock chart data for demonstration
  const chartData = [
    { day: 'Seg', executions: 45, success: 42 },
    { day: 'Ter', executions: 52, success: 48 },
    { day: 'Qua', executions: 38, success: 35 },
    { day: 'Qui', executions: 61, success: 58 },
    { day: 'Sex', executions: 47, success: 44 },
    { day: 'Sáb', executions: 23, success: 21 },
    { day: 'Dom', executions: 15, success: 14 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desempenho Semanal</CardTitle>
        <CardDescription>Execução e sucesso por dia</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {chartData.map((data, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground w-8">{data.day}</span>
              <div className="flex-1 mx-3">
                <div className="flex gap-1">
                  <div 
                    className="h-4 bg-blue-500 rounded"
                    style={{ width: `${(data.executions / 70) * 100}%` }}
                  />
                  <div 
                    className="h-4 bg-green-500 rounded"
                    style={{ width: `${(data.success / 70) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-muted-foreground">{data.executions}</span>
                <span className="text-green-600">{data.success}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>Sucesso</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ metrics }: { metrics: AutomationMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atividade Recente</CardTitle>
        <CardDescription>Últimas execuções da automação</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {metrics.recentExecutions.map((execution, index) => (
              <div key={execution.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  {execution.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{execution.automationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {execution.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {(execution.duration / 1000).toFixed(1)}s
                  </span>
                  <Badge variant={execution.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                    {execution.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Mock metrics generator
function generateMockMetrics(automation: Automation): AutomationMetrics {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return {
    total: 24,
    active: 18,
    inactive: 6,
    averageCreationTime: 12.5,
    successRate: 94.2,
    averageExecutionTime: 2.8,
    mostUsedTriggerType: TriggerType.MESSAGE_RECEIVED,
    mostUsedStepType: StepType.SEND_MESSAGE,
    averageStepsPerAutomation: 3.2,
    automationsCreatedToday: 3,
    automationsUpdatedToday: 5,
    averageTimeBetweenExecutions: 4.5,
    errorRate: 5.8,
    automationsWithIssues: 2,
    recentExecutions: [
      {
        id: 'exec-1',
        automationName: automation.name,
        status: 'success',
        duration: 2100,
        timestamp: new Date(now.getTime() - 5 * 60 * 1000),
      },
      {
        id: 'exec-2',
        automationName: automation.name,
        status: 'success',
        duration: 1850,
        timestamp: new Date(now.getTime() - 15 * 60 * 1000),
      },
      {
        id: 'exec-3',
        automationName: automation.name,
        status: 'failed',
        duration: 3200,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        id: 'exec-4',
        automationName: automation.name,
        status: 'success',
        duration: 1950,
        timestamp: new Date(now.getTime() - 45 * 60 * 1000),
      },
    ],
  };
}

export function AutomationMetrics({ automation, refreshInterval = 30 }: AutomationMetricsProps) {
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial metrics
    loadMetrics();

    // Set up refresh interval
    const interval = setInterval(loadMetrics, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [automation.id, refreshInterval]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would fetch from an API
      const mockMetrics = generateMockMetrics(automation);
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando métricas...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Não foi possível carregar as métricas
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Métricas e Desempenho</h3>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real da automação
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMetrics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Health Indicator */}
      <HealthIndicator metrics={metrics} />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total"
          value={metrics.total}
          description="Automações"
          icon={Target}
          trend="stable"
        />
        <MetricCard
          title="Taxa de Sucesso"
          value={`${metrics.successRate.toFixed(1)}%`}
          description="Execução bem-sucedida"
          icon={CheckCircle}
          trend="up"
        />
        <MetricCard
          title="Tempo Médio"
          value={`${metrics.averageExecutionTime.toFixed(1)}s`}
          description="Por execução"
          icon={Clock}
          trend="down"
        />
        <MetricCard
          title="Erros"
          value={metrics.errorRate.toFixed(1)}
          description="% de falhas"
          icon={AlertCircle}
          variant="warning"
          trend="down"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <PerformanceChart metrics={metrics} />
        <RecentActivity metrics={metrics} />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Gatilhos Mais Usados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{TRIGGER_LABELS[metrics.mostUsedTriggerType]}</span>
                <Badge variant="default">42%</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '42%' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              Passos Mais Usados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{STEP_LABELS[metrics.mostUsedStepType]}</span>
                <Badge variant="default">38%</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '38%' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Complexidade Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Passos por automação</span>
                <Badge variant="secondary">{metrics.averageStepsPerAutomation.toFixed(1)}</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${(metrics.averageStepsPerAutomation / 5) * 100}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}