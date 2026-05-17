import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const PrivacyPolicy = () => (
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
      <h1 className="text-3xl font-bold mb-2">Politica de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-8">Ultima atualizacao: 17 de maio de 2026</p>

      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Introducao</h2>
          <p>
            A AtendeAI ("nos", "nosso" ou "Plataforma") respeita a privacidade dos seus usuarios e esta comprometida em proteger os dados pessoais coletados. Esta Politica de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informacoes quando voce utiliza nossos servicos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. Dados que Coletamos</h2>
          <p>Podemos coletar os seguintes tipos de dados:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, CNPJ/CPF, nome da empresa.</li>
            <li><strong>Dados de uso:</strong> interacoes com a plataforma, logs de acesso, preferencias.</li>
            <li><strong>Dados de integracao:</strong> informacoes de contas conectadas (Instagram, WhatsApp, Facebook) conforme autorizado por voce.</li>
            <li><strong>Dados de comunicacao:</strong> mensagens trocadas atraves da plataforma entre voce e seus clientes.</li>
            <li><strong>Dados de pagamento:</strong> informacoes de cobranca processadas por parceiros de pagamento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. Como Usamos seus Dados</h2>
          <p>Utilizamos seus dados para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fornecer e manter nossos servicos.</li>
            <li>Processar mensagens e interacoes com seus clientes.</li>
            <li>Enviar notificacoes relevantes sobre o servico.</li>
            <li>Melhorar a experiencia do usuario e desenvolver novos recursos.</li>
            <li>Cumprir obrigacoes legais e regulatorias.</li>
            <li>Prevenir fraudes e garantir a seguranca da plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Integracoes com Terceiros</h2>
          <p>
            Nossa plataforma integra-se com servicos de terceiros, incluindo Meta (Instagram, WhatsApp, Facebook). Ao conectar sua conta, voce autoriza o acesso a determinadas informacoes conforme as permissoes solicitadas. Nos acessamos apenas os dados necessarios para fornecer o servico e nao vendemos suas informacoes a terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Compartilhamento de Dados</h2>
          <p>Podemos compartilhar seus dados com:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Provedores de servico:</strong> empresas que nos auxiliam na operacao (hospedagem, pagamentos, comunicacao).</li>
            <li><strong>Obrigacoes legais:</strong> quando exigido por lei ou ordem judicial.</li>
            <li><strong>Protecao de direitos:</strong> para proteger nossos direitos, propriedade ou seguranca.</li>
          </ul>
          <p>Nao vendemos, alugamos ou comercializamos seus dados pessoais.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Armazenamento e Seguranca</h2>
          <p>
            Seus dados sao armazenados em servidores seguros com criptografia em transito e em repouso. Implementamos medidas tecnicas e organizacionais para proteger contra acesso nao autorizado, alteracao, divulgacao ou destruicao.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Retencao de Dados</h2>
          <p>
            Mantemos seus dados pelo tempo necessario para fornecer os servicos ou conforme exigido por lei. Voce pode solicitar a exclusao dos seus dados a qualquer momento, sujeito a obrigacoes legais de retencao.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Seus Direitos (LGPD)</h2>
          <p>Conforme a Lei Geral de Protecao de Dados (LGPD), voce tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmar a existencia de tratamento de dados.</li>
            <li>Acessar seus dados pessoais.</li>
            <li>Corrigir dados incompletos ou desatualizados.</li>
            <li>Solicitar anonimizacao, bloqueio ou eliminacao de dados.</li>
            <li>Revogar consentimento a qualquer momento.</li>
            <li>Solicitar portabilidade dos dados.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">9. Cookies</h2>
          <p>
            Utilizamos cookies e tecnologias similares para melhorar a experiencia de navegacao, analisar o uso da plataforma e personalizar conteudo. Voce pode gerenciar suas preferencias de cookies nas configuracoes do navegador.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">10. Alteracoes nesta Politica</h2>
          <p>
            Podemos atualizar esta Politica periodicamente. Notificaremos sobre alteracoes significativas por e-mail ou aviso na plataforma. O uso continuado apos as alteracoes constitui aceitacao da politica atualizada.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">11. Contato</h2>
          <p>
            Para exercer seus direitos ou esclarecer duvidas sobre esta politica, entre em contato:
          </p>
          <ul className="list-none pl-0 space-y-1">
            <li><strong>E-mail:</strong> privacidade@atende-ai.tech</li>
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

export default PrivacyPolicy;
