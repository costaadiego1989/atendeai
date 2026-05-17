import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const TermsOfService = () => (
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

    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
      <p className="text-sm text-muted-foreground mb-8">Ultima atualizacao: 17 de maio de 2026</p>

      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Aceitacao dos Termos</h2>
          <p>
            Ao acessar ou utilizar a plataforma AtendeAI, voce concorda com estes Termos de Uso. Se voce nao concordar com algum dos termos, nao utilize nossos servicos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. Descricao do Servico</h2>
          <p>
            A AtendeAI e uma plataforma SaaS de gestao de atendimento, vendas e comunicacao para pequenas e medias empresas. Nossos servicos incluem:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Gestao de conversas via WhatsApp e Instagram.</li>
            <li>CRM e gestao de contatos.</li>
            <li>Agendamento de servicos.</li>
            <li>Automacao de atendimento com inteligencia artificial.</li>
            <li>Prospeccao e recuperacao de clientes.</li>
            <li>Gestao de catalogos e comercio.</li>
            <li>Cobranca e faturamento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. Cadastro e Conta</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Voce deve fornecer informacoes verdadeiras e completas no cadastro.</li>
            <li>Voce e responsavel por manter a confidencialidade da sua senha.</li>
            <li>Voce e responsavel por todas as atividades realizadas em sua conta.</li>
            <li>Notifique-nos imediatamente sobre qualquer uso nao autorizado.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Uso Aceitavel</h2>
          <p>Voce concorda em nao:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Enviar spam ou mensagens nao solicitadas em massa.</li>
            <li>Violar leis aplicaveis, incluindo a LGPD.</li>
            <li>Usar a plataforma para atividades ilegais ou fraudulentas.</li>
            <li>Tentar acessar dados de outros usuarios ou tenants.</li>
            <li>Realizar engenharia reversa ou interferir no funcionamento da plataforma.</li>
            <li>Compartilhar credenciais de acesso com terceiros nao autorizados.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Integracoes com Terceiros</h2>
          <p>
            A plataforma permite integracao com servicos de terceiros (Meta, Instagram, WhatsApp, etc.). Ao ativar essas integracoes, voce:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Autoriza a AtendeAI a acessar dados conforme as permissoes concedidas.</li>
            <li>Concorda com os termos de uso dos respectivos servicos de terceiros.</li>
            <li>Reconhece que a disponibilidade dessas integracoes depende dos provedores.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Pagamentos e Assinatura</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Os planos e precos estao disponiveis na pagina de planos.</li>
            <li>A cobranca e recorrente conforme o plano escolhido.</li>
            <li>Voce pode cancelar a assinatura a qualquer momento.</li>
            <li>Nao ha reembolso por periodos parciais ja utilizados.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Propriedade Intelectual</h2>
          <p>
            Todo o conteudo, codigo, design e marcas da AtendeAI sao de nossa propriedade ou licenciados para nos. Voce nao pode copiar, modificar, distribuir ou criar obras derivadas sem autorizacao expressa.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Limitacao de Responsabilidade</h2>
          <p>
            A AtendeAI nao se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso da plataforma. Nossa responsabilidade total esta limitada ao valor pago pelo usuario nos ultimos 12 meses.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">9. Disponibilidade do Servico</h2>
          <p>
            Nos esforçamos para manter a plataforma disponivel 24/7, mas nao garantimos disponibilidade ininterrupta. Manutencoes programadas serao comunicadas com antecedencia quando possivel.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">10. Suspensao e Encerramento</h2>
          <p>
            Podemos suspender ou encerrar sua conta se houver violacao destes termos, uso abusivo da plataforma ou inadimplencia. Em caso de encerramento, seus dados serao mantidos por 30 dias para recuperacao, apos o que serao excluidos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">11. Alteracoes nos Termos</h2>
          <p>
            Podemos modificar estes termos a qualquer momento. Alteracoes significativas serao comunicadas por e-mail ou notificacao na plataforma com 30 dias de antecedencia. O uso continuado apos as alteracoes constitui aceitacao.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">12. Legislacao Aplicavel</h2>
          <p>
            Estes termos sao regidos pelas leis da Republica Federativa do Brasil. Qualquer disputa sera resolvida no foro da comarca do Rio de Janeiro/RJ.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">13. Contato</h2>
          <p>Para duvidas sobre estes termos:</p>
          <ul className="list-none pl-0 space-y-1">
            <li><strong>E-mail:</strong> contato@atende-ai.tech</li>
            <li><strong>WhatsApp:</strong> +55 21 99300-1883</li>
          </ul>
        </section>
      </div>
    </main>

    <footer className="border-t border-primary/5 px-6 py-6 text-center">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} AtendeAI. Todos os direitos reservados.
      </p>
    </footer>
  </div>
);

export default TermsOfService;
