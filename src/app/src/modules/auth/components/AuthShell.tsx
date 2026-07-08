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

/**
 * Animated math/geometric background pattern for the left panel.
 * Creates a subtle enterprise feel with floating formulas and grid lines.
 */
function MathBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating math formulas - decorative SVG */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="math-pattern" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
            <text x="20" y="40" fill="white" fontSize="14" fontFamily="monospace">∫ f(x)dx = F(x) + C</text>
            <text x="200" y="80" fill="white" fontSize="12" fontFamily="monospace">∑ n=1→∞</text>
            <text x="50" y="130" fill="white" fontSize="13" fontFamily="monospace">∂y/∂x = lim Δy/Δx</text>
            <text x="250" y="160" fill="white" fontSize="11" fontFamily="monospace">E = mc²</text>
            <text x="30" y="220" fill="white" fontSize="12" fontFamily="monospace">∇ × B = μ₀J + μ₀ε₀∂E/∂t</text>
            <text x="220" y="250" fill="white" fontSize="14" fontFamily="monospace">λ = h/mv</text>
            <text x="80" y="300" fill="white" fontSize="11" fontFamily="monospace">P(A|B) = P(B|A)·P(A)/P(B)</text>
            <text x="260" y="340" fill="white" fontSize="13" fontFamily="monospace">∮ E·dA = Q/ε₀</text>
            <text x="40" y="380" fill="white" fontSize="12" fontFamily="monospace">σ² = Σ(xi-μ)²/N</text>
            <text x="280" y="30" fill="white" fontSize="11" fontFamily="monospace">∞ → 0</text>
            <text x="150" y="370" fill="white" fontSize="10" fontFamily="monospace">det(A-λI) = 0</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#math-pattern)" />
      </svg>

      {/* Glowing orbs for depth */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-purple-600/15 blur-[100px]" />
      <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />

      {/* Geometric lines */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="0" y1="30%" x2="100%" y2="70%" stroke="white" strokeWidth="0.5" />
        <line x1="20%" y1="0" x2="80%" y2="100%" stroke="white" strokeWidth="0.5" />
        <line x1="60%" y1="0" x2="20%" y2="100%" stroke="white" strokeWidth="0.5" />
        <circle cx="50%" cy="50%" r="180" fill="none" stroke="white" strokeWidth="0.5" opacity="0.5" />
        <circle cx="50%" cy="50%" r="280" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3" />
      </svg>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left panel — enterprise visual */}
        <section className="relative hidden lg:flex">
          <MathBackground />

          <div className="relative z-10 flex w-full flex-col justify-between p-10">
            <div className="space-y-6">
              <Link to="/login" className="inline-flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="AtendeAí"
                    className="h-full w-full object-contain drop-shadow-lg"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">AtendeAí</p>
                  <p className="text-sm text-white/60">
                    Sua máquina de vendas com IA pelo WhatsApp.
                  </p>
                </div>
              </Link>

              <div className="max-w-xl space-y-5 pt-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Sua Máquina de Vendas
                </div>
                <h1 className="text-4xl font-semibold leading-tight text-white">
                  O poder da automação por IA diretamente no seu WhatsApp.
                </h1>
                <p className="text-base leading-7 text-white/60">
                  Escale sua operação com uma ferramenta completa que engloba
                  prospecção, captação de clientes, gerenciamento de leads e
                  cobranças. A central que você precisa para revolucionar os
                  resultados da sua empresa.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-white/10 bg-white/5 backdrop-blur-md">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Automação
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Prospecção inteligente pelo WhatsApp no piloto automático.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 backdrop-blur-md">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                    CRM
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Gestão centralizada de leads para acelerar suas vendas.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 backdrop-blur-md">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Financeiro
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Controle de cobranças e inventário a um clique de distância.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Right panel — form */}
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

            <Card className="border-border/50 bg-card/70 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
              <CardContent className="p-6">{children}</CardContent>
            </Card>

            {footer && <div className="mt-5 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
