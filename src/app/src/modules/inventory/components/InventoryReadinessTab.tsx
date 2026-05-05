import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const READINESS_BLOCKS = [
  {
    title: 'Snapshot manual',
    description:
      'Equipe registra SKU, saldo e preço para a operação rodar sem depender do conector final.',
  },
  {
    title: 'Conector preparado',
    description:
      'As conexões de estoque já podem ser cadastradas, mesmo antes de construirmos o sync completo.',
  },
  {
    title: 'Catálogo conciliado',
    description:
      'Quando quiser, podemos ligar itens do estoque ao catálogo usando catalogItemId e referências externas.',
  },
];

export function InventoryReadinessTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {READINESS_BLOCKS.map((block) => (
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
