import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SocialSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocialSettingsSheet({ open, onOpenChange }: SocialSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[450px] sm:max-w-[450px]">
        <SheetHeader>
           <div className="flex items-center gap-2 text-primary bg-primary/10 w-fit p-2 rounded-xl mb-2">
            <Settings2 className="w-5 h-5"/>
          </div>
          <SheetTitle>Configurações Globais Sociais</SheetTitle>
          <SheetDescription>
            Ajuste o comportamento mestre do módulo de engajamento
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
           <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest">Segurança & Inbox</h3>
              
              <div className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Parada de Emergência</Label>
                  <p className="text-xs text-muted-foreground mr-4">Suspende todas as respostas automatizadas imediatamente.</p>
                </div>
                <Switch aria-label="Ativar parada de emergência" />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Limite Global de DM</Label>
                  <p className="text-xs text-muted-foreground mr-4">Rate limit diário máximo no Direct.</p>
                </div>
                <Select defaultValue="1000">
                   <SelectTrigger className="w-[100px] text-sm">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="100">100 / dia</SelectItem>
                      <SelectItem value="500">500 / dia</SelectItem>
                      <SelectItem value="1000">1000 / dia</SelectItem>
                      <SelectItem value="ilimitado">Sem Limite</SelectItem>
                   </SelectContent>
                </Select>
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mt-6">Notificações e Alertas</h3>
              
              <div className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Alertas de Crise</Label>
                  <p className="text-xs text-muted-foreground mr-4">Avisar gerentes se muitos comentários negativos ocorrerem.</p>
                </div>
                <Switch defaultChecked aria-label="Ativar alertas de crise" />
              </div>
           </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
