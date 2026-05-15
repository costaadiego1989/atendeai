import { Bell } from 'lucide-react';

export function AlertsHeader() {
  return (
    <div className="page-header mb-8">
      <h1 className="page-title flex items-center gap-2">
        <Bell className="h-6 w-6 text-primary" />
        Alertas
      </h1>
      <p className="page-description mt-1">
        Configure lembretes que o sistema envia no seu próprio WhatsApp para apoiar a rotina.
      </p>
    </div>
  );
}
