import { useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/shared/lib/usePageTitle';

/**
 * Public page served at /data-deletion.
 *
 * Meta's Data Deletion Callback requires the app to return a URL that users
 * can visit to confirm their data deletion was processed. The API endpoint
 * (MetaDataDeletionController) generates a `confirmation_code` and redirects
 * to this page with ?code=<confirmation_code>.
 *
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export default function DataDeletionPage() {
  usePageTitle('Exclusão de Dados');
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
        <div aria-hidden="true" className="text-4xl">🔒</div>

        <h1 className="text-xl font-semibold text-foreground">
          Solicitação de exclusão de dados
        </h1>

        <p className="text-sm text-muted-foreground">
          Recebemos sua solicitação de exclusão dos dados associados à sua conta
          no AtendeAI. Os dados foram ou serão removidos em conformidade com a{' '}
          <strong>Lei Geral de Proteção de Dados (LGPD)</strong> e com a
          política de privacidade da Meta.
        </p>

        {code && (
          <div className="rounded-md bg-muted px-4 py-3 text-left space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Código de confirmação
            </p>
            <p
              className="font-mono text-sm break-all text-foreground"
              aria-label="Código de confirmação da exclusão de dados"
            >
              {code}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Guarde o código acima caso precise comprovar que a solicitação foi
          registrada. Para dúvidas, entre em contato pelo e-mail{' '}
          <a
            href="mailto:privacidade@atende-ai.tech"
            className="underline hover:text-foreground transition-colors"
          >
            privacidade@atende-ai.tech
          </a>
          .
        </p>
      </div>
    </main>
  );
}
