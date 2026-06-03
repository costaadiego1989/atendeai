import { Users } from 'lucide-react';

interface ContactsKPIsProps {
  total: number;
  pipeline: number;
  customers: number;
  inactive: number;
}

export function ContactsKPIs({ total, pipeline, customers, inactive }: ContactsKPIsProps) {
  return (
    <div className="flex items-center gap-6 py-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Base de contatos</p>
          <p className="text-2xl font-bold">{total.toLocaleString('pt-BR')}</p>
        </div>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Funil ativo</p>
          <p className="text-xl font-semibold">{pipeline.toLocaleString('pt-BR')}</p>
        </div>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Clientes</p>
          <p className="text-xl font-semibold">{customers.toLocaleString('pt-BR')}</p>
        </div>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inativos</p>
          <p className="text-xl font-semibold">{inactive.toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
