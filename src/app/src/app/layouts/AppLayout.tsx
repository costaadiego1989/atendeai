import { ReactNode, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TrialBanner } from '@/components/TrialBanner';
import { QuotaExhaustedBanner } from '@/components/QuotaExhaustedBanner';
import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Contact2,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  LifeBuoy,
  Link as LinkIcon,
  LogOut,
  MessageSquare,
  Search,
  ShoppingCart,
  Tag,
  UserPlus,
  Webhook,
  Share2,
} from 'lucide-react';
import { ActiveBranchSelector } from '@/components/ActiveBranchSelector';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { authService } from '@/modules/auth/services/auth-service';
import { GlobalConversationNotifier } from '@/modules/messaging/components/GlobalConversationNotifier';
import { ModuleFeedbackFab } from '@/modules/support/components/ModuleFeedbackFab';
import { UserProfileSheet } from '@/modules/users/components/UserProfileSheet';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useUIStore } from '@/shared/stores/ui-store';
import { filterNavByNiche } from '@/app/helpers/niche-nav-filter';

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Conversas', path: '/app/conversations', icon: MessageSquare },
  { label: 'Engajamento', path: '/app/social', icon: Share2 },
  { label: 'Contatos', path: '/app/contacts', icon: Contact2 },
  { label: 'Agenda', path: '/app/scheduling', icon: Calendar },
  { label: 'Cobranças', path: '/app/recovery', icon: History },
];

const salesNav: NavItem[] = [
  { label: 'Catálogo', path: '/app/catalog', icon: BookOpen },
  { label: 'Estoque', path: '/app/inventory', icon: Archive },
  { label: 'Propostas', path: '/app/proposals', icon: FileText },
  { label: 'Checkout', path: '/app/checkout', icon: ShoppingCart },
  { label: 'Métricas', path: '/app/sales/metrics', icon: BarChart3 },
  { label: 'Links de pagamento', path: '/app/sales/payment-links', icon: LinkIcon },
  { label: 'Promoções', path: '/app/sales/promotions', icon: Tag },
];

const prospectingNav: NavItem[] = [
  { label: 'Prospecção', path: '/app/prospecting/searches', icon: Search },
];

const settingsNav: NavItem[] = [
  { label: 'Empresa', path: '/app/settings/company', icon: Building2 },
  { label: 'Integrações', path: '/app/settings/integrations', icon: Webhook },
  { label: 'Canais', path: '/app/settings/channels', icon: MessageSquare },
  { label: 'Alertas', path: '/app/settings/alerts', icon: Bell },
  { label: 'Suporte', path: '/app/settings/support', icon: LifeBuoy },
  { label: 'Assistente IA', path: '/app/settings/ai', icon: Bot },
  { label: 'Equipe', path: '/app/team', icon: UserPlus },
  { label: 'Plano e consumo', path: '/app/billing/usage', icon: CreditCard },
];

function NavSection({
  title,
  items,
  collapsed,
  currentPath,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  currentPath: string;
}) {
  return (
    <div className="mb-2">
      {!collapsed && (
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
          {title}
        </p>
      )}
      {items.map((item) => {
        const active = currentPath.startsWith(item.path) && item.path !== '#';

        return (
          <Link
            key={`${item.path}-${item.label}`}
            to={item.path}
            className={cn(
              'mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              item.path === '#' && 'pointer-events-none opacity-40',
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, tenant, activeBranchId, clearSession } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };

  const content = children ?? <Outlet />;
  const businessType = tenant?.businessType;

  const filteredMainNav = filterNavByNiche(mainNav, businessType);
  const filteredSalesNav = filterNavByNiche(salesNav, businessType);
  const filteredProspectingNav = filterNavByNiche(prospectingNav, businessType);

  const tenantPlan = tenant?.billingAccess?.plan?.toUpperCase();
  const filteredSettingsNav = settingsNav.filter((item) => {
    // Hide "Integrações" for TRIAL plan — requires at least Essencial
    if (item.path === '/app/settings/integrations' && tenantPlan === 'TRIAL') {
      return false;
    }
    // Hide team management for AGENT role
    if (item.path === '/app/team' && user?.role === 'AGENT') {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      <GlobalConversationNotifier />

      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-all duration-200',
          sidebarCollapsed ? 'w-[60px]' : 'w-[240px]',
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border/50 px-4">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center">
                <img
                  src="/logo.png"
                  alt="AtendeAi"
                  className="h-full w-full object-contain drop-shadow-sm"
                />
              </div>
              <span className="text-base font-bold text-sidebar-accent-foreground">
                AtendeAi
              </span>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center">
              <img
                src="/logo.png"
                alt="AtendeAi"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <NavSection
            title="Principal"
            items={filteredMainNav}
            collapsed={sidebarCollapsed}
            currentPath={location.pathname}
          />
          {filteredSalesNav.length > 0 && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              <NavSection
                title="Comercial"
                items={filteredSalesNav}
                collapsed={sidebarCollapsed}
                currentPath={location.pathname}
              />
            </>
          )}
          {filteredProspectingNav.length > 0 && (
            <NavSection
              title="ProspecÃ§Ã£o"
              items={filteredProspectingNav}
              collapsed={sidebarCollapsed}
              currentPath={location.pathname}
            />
          )}
          <Separator className="my-2 bg-sidebar-border" />
          <NavSection
            title="Configuracoes"
            items={filteredSettingsNav}
            collapsed={sidebarCollapsed}
            currentPath={location.pathname}
          />
        </nav>

        <div className="mt-auto space-y-1 border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className={cn(
              'w-full px-3 py-2 text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              sidebarCollapsed ? 'justify-center' : 'justify-start',
            )}
            title="Sair do sistema"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Sair</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        <QuotaExhaustedBanner />
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/40 px-5 backdrop-blur-md">
          <ActiveBranchSelector />

          <div className="flex items-center gap-2">
            <DarkModeToggle />

            {user && (
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/60"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-[13px] font-medium text-foreground md:inline">{user.name}</span>
              </button>
            )}
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          {content}
          <ModuleFeedbackFab />
        </main>

        <UserProfileSheet open={isProfileOpen} onOpenChange={setIsProfileOpen} />
      </div>
    </div>
  );
}

