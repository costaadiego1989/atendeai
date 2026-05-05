import { motion } from "framer-motion";
import { Zap, CreditCard, HelpCircle, Users } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import logo from "@/assets/logo.png";

const WA_LINK = "https://wa.me/5521993001883";

const items = [
  { icon: Zap, label: "Início", href: "#" },
  { icon: Users, label: "Sobre", href: "#sobre" },
  { icon: null, label: "AtendeAI", href: "#", isLogo: true },
  { icon: CreditCard, label: "Planos", href: "#planos" },
  { icon: null, label: "WhatsApp", href: WA_LINK, external: true, isWa: true },
];

const MobileFooterNav = () => (
  <motion.nav
    initial={{ y: 100 }}
    animate={{ y: 0 }}
    transition={{ delay: 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
  >
    <div className="glass-surface rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.4)] px-1 py-2 flex items-center justify-around">
      {items.map((item) => {
        if (item.isLogo) {
          return (
            <a key="logo" href="#" className="flex flex-col items-center justify-center">
              <img src={logo} alt="AtendeAI" className="w-24 h-24 drop-shadow-[0_0_15px_rgba(0,230,118,0.3)]" />
            </a>
          );
        }
        if (item.isWa) {
          return (
            <a
              key="whatsapp"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground"
            >
              <WhatsAppIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          );
        }
        const Icon = item.icon!;
        return (
          <a
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </a>
        );
      })}
    </div>
  </motion.nav>
);

export default MobileFooterNav;
