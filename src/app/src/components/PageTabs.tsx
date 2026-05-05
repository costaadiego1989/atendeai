import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface PageTabsListProps {
  tabs: TabItem[];
  className?: string;
  containerClassName?: string;
}

/**
 * Componente de lista de abas padronizado para o AtendeAí.
 * Alinhado à esquerda por padrão, com design premium e suporte a ícones.
 */
export function PageTabsList({ tabs, className, containerClassName }: PageTabsListProps) {
  return (
    <div className={cn("flex max-w-full justify-start overflow-hidden", containerClassName)}>
      <TabsList 
        className={cn(
          "flex h-12 max-w-full w-fit items-center rounded-2xl bg-muted/50 p-1.5 backdrop-blur-sm border border-border/40 transition-all overflow-x-auto shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-full shrink-0 gap-2 rounded-xl px-5 font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm whitespace-nowrap"
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
