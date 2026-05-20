import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Zap, Users, CreditCard, HelpCircle, ArrowUp, Gift, BrainCircuit, Shield, FileText, Stethoscope, Building2, ShoppingBag, Briefcase, Scale, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import WhatsAppIcon from "./WhatsAppIcon";
import logo from "@/assets/logo.png";

const WA_LINK = "https://wa.me/5521993001883";

const navLinks = [
  { label: "Como funciona", href: "#como-funciona", icon: Zap },
  { label: "Benefícios", href: "#beneficios", icon: Gift },
  { label: "Sobre nós", href: "#sobre", icon: Users },
  { label: "Planos", href: "#planos", icon: CreditCard },
  { label: "FAQ", href: "#faq", icon: HelpCircle },
];

const solucoesLinks = [
  { label: "Clínicas e Saúde", slug: "clinicas-saude", icon: Stethoscope },
  { label: "Imobiliárias", slug: "imobiliarias", icon: Building2 },
  { label: "Ecommerce", slug: "ecommerce", icon: ShoppingBag },
  { label: "Serviços B2B", slug: "servicos-b2b", icon: Briefcase },
  { label: "Advocacia", slug: "advocacia", icon: Scale },
  { label: "Educação", slug: "educacao", icon: GraduationCap },
];

const Footer = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <footer ref={ref} className="relative px-6 pt-16 pb-28 md:pb-12 border-t border-primary/5 bg-card/30">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/3 to-transparent" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start gap-3"
          >
            <a href="#" className="flex items-center gap-2.5">
              <img src={logo} alt="AtendeAI" className="h-10 w-10" />
              <span className="font-bold text-lg text-foreground tracking-tight">AtendeAI</span>
            </a>
            <p className="text-sm text-muted-foreground text-left">
              Máquina de vendas inteligente. Atendimento, prospecção e cobrança em um único fluxo.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <BrainCircuit className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary font-medium">Powered by Athom Technologies LTDA</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start gap-2"
          >
            <h4 className="text-sm font-semibold text-foreground mb-1">Navegação</h4>
            {navLinks.map((link, i) => {
              const Icon = link.icon;
              return (
                <motion.a
                  key={link.href}
                  href={link.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  {link.label}
                </motion.a>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start gap-2"
          >
            <h4 className="text-sm font-semibold text-foreground mb-1">Soluções</h4>
            {solucoesLinks.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.slug}
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={`/solucoes/${item.slug}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    {item.label}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start gap-3"
          >
            <h4 className="text-sm font-semibold text-foreground mb-1">Contato</h4>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Falar no WhatsApp
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              <ArrowUp className="w-4 h-4" />
              Voltar ao topo
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="border-t border-primary/5 pt-6 text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacidade" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Shield className="w-3.5 h-3.5" />
              Politica de Privacidade
            </Link>
            <span className="text-xs text-muted-foreground/50">|</span>
            <Link to="/termos" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="w-3.5 h-3.5" />
              Termos de Uso
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AtendeAI. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
