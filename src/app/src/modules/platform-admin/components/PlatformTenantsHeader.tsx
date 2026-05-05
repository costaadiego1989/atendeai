export function PlatformTenantsHeader() {
  return (
    <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="page-title">Operação de plataforma</h1>
        <p className="page-description">
          Visão consolidada de tenants com plano, quotas e uso do ciclo corrente. Dados da API{' '}
          <span className="font-mono text-xs">GET /platform/tenants</span>.
        </p>
      </div>
    </div>
  );
}
