import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import DataDeletion from "./pages/DataDeletion.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import SupportFeedbacksPage from "./pages/admin/support/SupportFeedbacksPage.tsx";
import DashboardPage from "./pages/admin/dashboard/DashboardPage.tsx";
import TenantsPage from "./pages/admin/tenants/TenantsPage.tsx";
import BillingPage from "./pages/admin/billing/BillingPage.tsx";
import MessagingPage from "./pages/admin/messaging/MessagingPage.tsx";
import SalesPage from "./pages/admin/sales/SalesPage.tsx";
import CommercePage from "./pages/admin/commerce/CommercePage.tsx";
import RecoveryPage from "./pages/admin/recovery/RecoveryPage.tsx";
import ContactsPage from "./pages/admin/contacts/ContactsPage.tsx";
import ProspectingPage from "./pages/admin/prospecting/ProspectingPage.tsx";
import SchedulingPage from "./pages/admin/scheduling/SchedulingPage.tsx";
import AIPage from "./pages/admin/ai/AIPage.tsx";
import SocialPage from "./pages/admin/social/SocialPage.tsx";
import CatalogPage from "./pages/admin/catalog/CatalogPage.tsx";
import InventoryPage from "./pages/admin/inventory/InventoryPage.tsx";
import ProposalsPage from "./pages/admin/proposals/ProposalsPage.tsx";
import PaymentPage from "./pages/admin/payment/PaymentPage.tsx";
import AuthPage from "./pages/admin/auth/AuthPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="commerce" element={<CommercePage />} />
            <Route path="recovery" element={<RecoveryPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="prospecting" element={<ProspectingPage />} />
            <Route path="scheduling" element={<SchedulingPage />} />
            <Route path="ai" element={<AIPage />} />
            <Route path="social" element={<SocialPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="proposals" element={<ProposalsPage />} />
            <Route path="payment" element={<PaymentPage />} />
            <Route path="auth" element={<AuthPage />} />
            <Route path="support" element={<SupportFeedbacksPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
