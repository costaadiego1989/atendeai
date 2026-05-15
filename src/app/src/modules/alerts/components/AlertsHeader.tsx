export function AlertsHeader() {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Alertas</h1>
        <p className="page-description mt-1">
          Configure lembretes que o sistema envia no seu próprio WhatsApp para apoiar a rotina.
        </p>
      </div>
    </div>
  );
}
