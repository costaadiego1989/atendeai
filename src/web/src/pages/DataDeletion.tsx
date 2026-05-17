import { ArrowLeft, CheckCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";

const DataDeletion = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-primary/5 bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="AtendeAI" className="h-8 w-8" />
            <span className="font-bold text-lg tracking-tight">AtendeAI</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-4">Exclusao de Dados</h1>

        <p className="text-muted-foreground mb-6">
          Sua solicitacao de exclusao de dados foi processada com sucesso. Todos os dados associados a sua conta na plataforma AtendeAI foram removidos conforme exigido.
        </p>

        {code && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Codigo de confirmacao:</p>
            <p className="font-mono text-sm font-medium">{code}</p>
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-6 text-left space-y-3">
          <h2 className="font-semibold text-sm">O que foi removido:</h2>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Dados de perfil e informacoes da conta Instagram conectada</li>
            <li>• Tokens de acesso e autorizacoes</li>
            <li>• Dados de interacoes processados pela plataforma</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Em caso de duvidas, entre em contato: privacidade@atende-ai.tech
        </p>
      </main>

      <footer className="border-t border-primary/5 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} AtendeAI. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default DataDeletion;
