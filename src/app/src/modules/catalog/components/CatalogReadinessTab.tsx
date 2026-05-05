import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CatalogReadinessTab() {
  const blocks = [
    {
      title: 'Agenda',
      description: 'Serviços do catálogo podem ser usados como base para disponibilidade, duração e precificação operacional.',
    },
    {
      title: 'Estoque',
      description: 'Produtos e locações podem abrir controle de estoque direto do catálogo, enquanto serviços seguem sem esse acoplamento.',
    },
    {
      title: 'IA comercial',
      description: 'Descrição, tags e categoria alimentam respostas ricas e próximas do contexto da empresa.',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {blocks.map((block) => (
        <Card key={block.title} className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">{block.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{block.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
