import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { AuthGuard } from '@/shared/ui/AuthGuard';
import { SubscriptionGuard } from '@/shared/ui/SubscriptionGuard';
import { ModuleAccessGuard } from '@/shared/ui/ModuleAccessGuard';
import { AppLayout } from '@/app/layouts/AppLayout';
import { useAuthBootstrap } from '@/modules/auth/view-models/useAuthBootstrap';
import LoginPage from '@/modules/auth/views/LoginPage';
import RegisterPage from '@/modules/auth/views/RegisterPage';
import ForgotPasswordPage from '@/modules/auth/views/ForgotPasswordPage';
import ResetPasswordPage from '@/modules/auth/views/ResetPasswordPage';
import FirstAccessPasswordPage from '@/modules/auth/views/FirstAccessPasswordPage';
import DashboardPage from '@/modules/dashboard/views/DashboardPage';
import ConversationsPage from '@/modules/messaging/views/ConversationsPage';
import CatalogPage from '@/modules/catalog/views/CatalogPage';
import ContactsListPage from '@/modules/contacts/views/ContactsListPage';
import ContactDetailPage from '@/modules/contacts/views/ContactDetailPage';
import InventoryPage from '@/modules/inventory/views/InventoryPage';
import ProposalsPage from '@/modules/proposals/views/ProposalsPage';
import SchedulingPage from '@/modules/scheduling/views/SchedulingPage';
import RecoveryPage from '@/modules/recovery/views/RecoveryPage';
import CheckoutPage from '@/modules/checkout/views/CheckoutPage';
import {
  PaymentLinksPage,
  SalesMetricsPage,
  PromotionsCouponsPage,
} from '@/modules/sales/views/SalesPages';
import BillingUsagePage from '@/modules/billing/views/BillingUsagePage';
import AlertsPage from '@/modules/alerts/views/AlertsPage';
import {
  ProspectingSearchesPage,
} from '@/modules/prospecting/views/ProspectingPages';
import SupportPage from '@/modules/support/views/SupportPage';
import {
  ChannelsSettingsPage,
} from '@/modules/settings/views/SettingsPages';
import { IntegrationsSettingsPage } from '@/modules/settings/views/IntegrationsSettingsPage';
import { AISettingsPage } from '@/modules/settings/views/AISettingsPage';
import TenantDataPage from '@/modules/settings/views/TenantDataPage';
import { SocialPage } from '@/modules/social/views/SocialPage';
import TeamPage from '@/modules/users/views/TeamPage';
import { PlatformAdminNavGate } from '@/shared/ui/PlatformAdminNavGate';
import PlatformTenantsPage from '@/modules/platform-admin/views/PlatformTenantsPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  useAuthBootstrap();

  const withModuleAccess = (moduleCode: string, element: JSX.Element) => (
    <ModuleAccessGuard moduleCode={moduleCode}>{element}</ModuleAccessGuard>
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/esqueci-senha"
        element={<Navigate to="/forgot-password" replace />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/first-access-password" element={<FirstAccessPasswordPage />} />
      <Route
        path="/redefinir-senha"
        element={<Navigate to="/reset-password" replace />}
      />

      <Route
        path="/app"
        element={
          <AuthGuard>
            <SubscriptionGuard>
              <AppLayout />
            </SubscriptionGuard>
          </AuthGuard>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route
          path="conversations/:conversationId"
          element={<ConversationsPage />}
        />
        <Route path="contacts" element={<ContactsListPage />} />
        <Route path="contacts/:contactId" element={<ContactDetailPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="proposals" element={<ProposalsPage />} />
        <Route
          path="inventory"
          element={withModuleAccess('ESTOQUE_IA', <InventoryPage />)}
        />
        <Route
          path="recovery"
          element={withModuleAccess('Cobrança_AUTO', <RecoveryPage />)}
        />
        <Route
          path="scheduling"
          element={withModuleAccess('AGENDAMENTO_ONLINE', <SchedulingPage />)}
        />
        <Route
          path="scheduling/professionals"
          element={withModuleAccess('AGENDAMENTO_ONLINE', <SchedulingPage />)}
        />
        <Route
          path="scheduling/categories"
          element={withModuleAccess('AGENDAMENTO_ONLINE', <SchedulingPage />)}
        />
        <Route
          path="checkout"
          element={withModuleAccess('CHECKOUT_WA', <CheckoutPage />)}
        />
        <Route
          path="sales/metrics"
          element={withModuleAccess('CHECKOUT_WA', <SalesMetricsPage />)}
        />
        <Route
          path="sales/payment-links"
          element={withModuleAccess('CHECKOUT_WA', <PaymentLinksPage />)}
        />
        <Route
          path="sales/promotions"
          element={withModuleAccess('CHECKOUT_WA', <PromotionsCouponsPage />)}
        />
        <Route path="billing/usage" element={<BillingUsagePage />} />
        <Route
          path="prospecting/searches"
          element={withModuleAccess('PROSPECCAO_ATIVA', <ProspectingSearchesPage />)}
        />
        <Route
          path="prospecting/campaigns"
          element={<Navigate to="/app/prospecting/searches" replace />}
        />
        <Route path="settings/company" element={<TenantDataPage />} />
        <Route
          path="settings/integrations"
          element={withModuleAccess('INTEGRATIONS_HUB', <IntegrationsSettingsPage />)}
        />
        <Route path="settings/channels" element={<ChannelsSettingsPage />} />
        <Route path="settings/alerts" element={<AlertsPage />} />
        <Route path="settings/support" element={<SupportPage />} />
        <Route path="settings/ai" element={<AISettingsPage />} />
        <Route
          path="social"
          element={withModuleAccess('OMNICHANNEL_SOCIAL', <SocialPage />)}
        />
        <Route path="team" element={<TeamPage />} />
        <Route
          path="platform/tenants"
          element={
            <PlatformAdminNavGate>
              <PlatformTenantsPage />
            </PlatformAdminNavGate>
          }
        />
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AppRoutes />
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
