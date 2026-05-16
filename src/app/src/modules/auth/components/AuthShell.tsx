import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-border/50 bg-card/20 backdrop-blur-xl lg:flex">
          <div className="flex w-full flex-col justify-between p-10">
            <div className="space-y-6">
              <Link to="/login" className="inline-flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="AtendeAí"
                    className="h-full w-full object-contain drop-shadow-sm"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">AtendeAí</p>
                  <p className="text-sm text-muted-foreground">
                    Sua máquina de vendas com IA pelo WhatsApp.
                  </p>
                </div>
              </Link>

              <div className="max-w-xl space-y-5 pt-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Sua Máquina de Vendas
                </div>
                <h1 className="text-4xl font-semibold leading-tight text-foreground">
                  O poder da automação por IA diretamente no seu WhatsApp.
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Escale sua operação com uma ferramenta completa que engloba
                  prospecção, captação de clientes, gerenciamento de leads e
                  cobranças. A central que você precisa para revolucionar os
                  resultados da sua empresa.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/60 bg-background/70">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Automação
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Prospecção inteligente pelo WhatsApp no piloto automático.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/70">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    CRM
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Gestão centralizada de leads para acelerar suas vendas.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-background/70">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Financeiro
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    Controle de cobranças e inventário a um clique de distância.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-3 lg:hidden">
              <Link to="/login" className="inline-flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="AtendeAí"
                    className="h-full w-full object-contain drop-shadow-sm"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">AtendeAí</p>
                  <p className="text-sm text-muted-foreground">
                    Sua Máquina de Vendas
                  </p>
                </div>
              </Link>
            </div>

            <div className="mb-8 space-y-2">
              <h2 className="text-3xl font-semibold text-foreground">{title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>

            <Card className="border-border/50 bg-card/70 backdrop-blur-md shadow-xl rounded-[32px] overflow-hidden">
              <CardContent className="p-6">{children}</CardContent>
            </Card>

            {footer && <div className="mt-5 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
