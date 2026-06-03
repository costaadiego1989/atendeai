import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Zap, 
  Settings, 
  Activity, 
  BarChart3, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Save,
  Play,
  Pause,
  Eye,
  Database,
  Network,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Automation } from '../types';

interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'memory' | 'network' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  config: Record<string, any>;
  impact: {
    performance: number; // percentage improvement
    memory: number; // percentage saved
    reliability: number; // percentage improvement
  };
  lastApplied: Date | null;
}

interface OptimizationResult {
  id: string;
  ruleId: string;
  status: 'applied' | 'pending' | 'failed';
  timestamp: Date;
  metrics: {
    before: {
      executionTime: number;
      memoryUsage: number;
      errorRate: number;
    };
    after: {
      executionTime: number;
      memoryUsage: number;
      errorRate: number;
    };
  };
  savings: {
    timeSaved: number; // in seconds per execution
    memorySaved: number; // in MB
    costSaved: number; // in currency
  };
}

interface PerformanceOptimizerProps {
  automation: Automation;
  onOptimizationApplied?: (results: OptimizationResult[]) => void;
}

interface OptimizationCardProps {
  rule: OptimizationRule;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onApply: (ruleId: string) => void;
  isApplying: string;
}

function OptimizationCard({ rule, onToggle, onApply, isApplying }: OptimizationCardProps) {
  const severityColors = {
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const categoryIcons = {
    performance: Zap,
    memory: Database,
    network: Network,
    security: Shield,
  };

  const CategoryIcon = categoryIcons[rule.category];

  return (
    <Card className={`${rule.enabled ? 'ring-2 ring-green-500/20' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CategoryIcon className="h-4 w-4" />
              <CardTitle className="text-base">{rule.name}</CardTitle>
              <Badge 
                variant="outline" 
                className={`text-xs ${severityColors[rule.severity]}`}
              >
                {rule.severity}
              </Badge>
            </div>
            <CardDescription>{rule.description}</CardDescription>
          </div>
          <Switch
            checked={rule.enabled}
            onCheckedChange={(enabled) => onToggle(rule.id, enabled)}
          />
        </div>
      </CardHeader>

      {rule.enabled && (
        <CardContent>
          {/* Impact Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-green-50 rounded">
              <p className="text-xs text-green-600 font-medium">Performance</p>
              <p className="text-lg font-bold text-green-700">+{rule.impact.performance}%</p>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-600 font-medium">Memória</p>
              <p className="text-lg font-bold text-blue-700">-{rule.impact.memory}%</p>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded">
              <p className="text-xs text-purple-600 font-medium">Confiabilidade</p>
              <p className="text-lg font-bold text-purple-700">+{rule.impact.reliability}%</p>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-medium">Configuração</h4>
            <div className="bg-muted p-2 rounded text-xs space-y-1">
              {Object.entries(rule.config).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-medium">{key}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {rule.lastApplied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    Aplicado {rule.lastApplied.toLocaleDateString('pt-BR')}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600">Aguardando aplicação</span>
                </>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => onApply(rule.id)}
              disabled={isApplying === rule.id || !!rule.lastApplied}
              className="gap-1.5"
            >
              {isApplying === rule.id ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Aplicar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function OptimizationSummary({ results }: { results: OptimizationResult[] }) {
  const totalSavings = useMemo(() => {
    return results.reduce((acc, result) => ({
      timeSaved: acc.timeSaved + result.savings.timeSaved,
      memorySaved: acc.memorySaved + result.savings.memorySaved,
      costSaved: acc.costSaved + result.savings.costSaved,
    }), { timeSaved: 0, memorySaved: 0, costSaved: 0 });
  }, [results]);

  const averageImprovement = useMemo(() => {
    if (results.length === 0) return { performance: 0, memory: 0, reliability: 0 };
    
    const total = results.reduce((acc, result) => ({
      performance: acc.performance + (result.metrics.after.executionTime / result.metrics.before.executionTime - 1),
      memory: acc.memory + (result.metrics.before.memoryUsage / result.metrics.after.memoryUsage - 1),
      reliability: acc.reliability + (1 - result.metrics.after.errorRate / result.metrics.before.errorRate),
    }), { performance: 0, memory: 0, reliability: 0 });

    return {
      performance: (total.performance / results.length) * 100,
      memory: (total.memory / results.length) * 100,
      reliability: (total.reliability / results.length) * 100,
    };
  }, [results]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Resumo das Otimizações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded">
            <p className="text-xs text-green-600 font-medium">Tempo Economizado</p>
            <p className="text-lg font-bold text-green-700">
              {totalSavings.timeSaved.toFixed(1)}s/execução
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <p className="text-xs text-blue-600 font-medium">Memória Economizada</p>
            <p className="text-lg font-bold text-blue-700">
              {totalSavings.memorySaved.toFixed(1)}MB
            </p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded">
            <p className="text-xs text-purple-600 font-medium">Custo Economizado</p>
            <p className="text-lg font-bold text-purple-700">
              R$ {totalSavings.costSaved.toFixed(2)}/mês
            </p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded">
            <p className="text-xs text-orange-600 font-medium">Otimizações Ativas</p>
            <p className="text-lg font-bold text-orange-700">
              {results.length} regras
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">Média de Melhoria</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Performance</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  +{averageImprovement.performance.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Uso de Memória</span>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  -{averageImprovement.memory.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Confiabilidade</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">
                  +{averageImprovement.reliability.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mock optimization rules
function generateMockRules(): OptimizationRule[] {
  return [
    {
      id: 'rule-1',
      name: 'Cache de Gatilhos',
      description: 'Armazena resultados de gatilhos frequentes para evitar recálculos',
      category: 'performance',
      severity: 'medium',
      enabled: false,
      config: { ttl: 300, maxSize: 1000 },
      impact: { performance: 25, memory: 5, reliability: 10 },
      lastApplied: null,
    },
    {
      id: 'rule-2',
      name: 'Batch Processing',
      description: 'Processa múltiplas execuções em lote para reduzir overhead',
      category: 'network',
      severity: 'high',
      enabled: false,
      config: { batchSize: 10, timeout: 5000 },
      impact: { performance: 40, memory: 15, reliability: 5 },
      lastApplied: null,
    },
    {
      id: 'rule-3',
      name: 'Memory Pool',
      description: 'Reutiliza objetos de memória para reduzir alocação',
      category: 'memory',
      severity: 'low',
      enabled: false,
      config: { poolSize: 50, objectType: 'automation-step' },
      impact: { performance: 15, memory: 30, reliability: 5 },
      lastApplied: null,
    },
    {
      id: 'rule-4',
      name: 'Circuit Breaker',
      description: 'Previne falhas em cascata durante erros de sistema',
      category: 'security',
      severity: 'critical',
      enabled: false,
      config: { failureThreshold: 5, timeout: 30000, recoveryTimeout: 60000 },
      impact: { performance: 5, memory: 2, reliability: 50 },
      lastApplied: null,
    },
  ];
}

// Mock optimization result generator
function generateMockResult(rule: OptimizationRule): OptimizationResult {
  const before = {
    executionTime: 2500 + Math.random() * 1000,
    memoryUsage: 50 + Math.random() * 20,
    errorRate: 2 + Math.random() * 3,
  };

  const improvement = {
    performance: rule.impact.performance / 100,
    memory: rule.impact.memory / 100,
    reliability: rule.impact.reliability / 100,
  };

  return {
    id: `result-${Date.now()}`,
    ruleId: rule.id,
    status: 'applied',
    timestamp: new Date(),
    metrics: {
      before,
      after: {
        executionTime: before.executionTime * (1 - improvement.performance),
        memoryUsage: before.memoryUsage * (1 - improvement.memory),
        errorRate: before.errorRate * (1 - improvement.reliability),
      },
    },
    savings: {
      timeSaved: (before.executionTime - before.executionTime * (1 - improvement.performance)) / 1000,
      memorySaved: before.memoryUsage - before.memoryUsage * (1 - improvement.memory),
      costSaved: (before.executionTime / 1000) * 0.01 * 1000, // R$ 0.01 por segundo
    },
  };
}

export function PerformanceOptimizer({ automation, onOptimizationApplied }: PerformanceOptimizerProps) {
  const [rules, setRules] = useState<OptimizationRule[]>([]);
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [autoOptimize, setAutoOptimize] = useState(false);

  useEffect(() => {
    // Load optimization rules
    setRules(generateMockRules());
  }, []);

  const handleToggleRule = useCallback((ruleId: string, enabled: boolean) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled } : rule
    ));
  }, []);

  const handleApplyRule = useCallback(async (ruleId: string) => {
    setIsApplying(ruleId);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        const result = generateMockResult(rule);
        setResults(prev => [...prev, result]);
        
        // Update rule last applied
        setRules(prev => prev.map(r => 
          r.id === ruleId ? { ...r, lastApplied: new Date() } : r
        ));
      }
    } catch (error) {
      console.error('Failed to apply rule:', error);
    } finally {
      setIsApplying(null);
    }
  }, [rules]);

  const handleApplyAll = useCallback(async () => {
    const enabledRules = rules.filter(rule => rule.enabled && !rule.lastApplied);
    
    for (const rule of enabledRules) {
      await handleApplyRule(rule.id);
    }
  }, [rules, handleApplyRule]);

  const handleReset = useCallback(() => {
    setRules(prev => prev.map(rule => ({
      ...rule,
      enabled: false,
      lastApplied: null,
    })));
    setResults([]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Otimizador de Performance
          </h3>
          <p className="text-sm text-muted-foreground">
            Melhore a performance e eficiência da sua automação
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={results.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
          <Button
            onClick={handleApplyAll}
            disabled={rules.filter(r => r.enabled && !r.lastApplied).length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Aplicar Todas
          </Button>
        </div>
      </div>

      {/* Auto-Optimization Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium">Otimização Automática</h4>
              <p className="text-sm text-muted-foreground">
                Ative para otimizações serem aplicadas automaticamente com base em métricas
              </p>
            </div>
            <Switch
              checked={autoOptimize}
              onCheckedChange={setAutoOptimize}
            />
          </div>
        </CardContent>
      </Card>

      {/* Optimization Rules */}
      <div className="space-y-4">
        <h4 className="font-medium">Regras de Otimização</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <OptimizationCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggleRule}
              onApply={handleApplyRule}
              isApplying={isApplying || ''}
            />
          ))}
        </div>
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <OptimizationSummary results={results} />
      )}

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Métricas de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Tempo de Execução</span>
                <span className="text-sm font-medium">2.1s</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Uso de Memória</span>
                <span className="text-sm font-medium">35MB</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Erros</span>
                <span className="text-sm font-medium">0.5%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '95%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}