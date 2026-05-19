import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { isAuthenticated, clearApiKey } from "@/services/adminApi";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/admin" replace />;
  }

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Tenants", path: "/admin/tenants" },
    { label: "Billing", path: "/admin/billing" },
    { label: "Messaging", path: "/admin/messaging" },
    { label: "Vendas", path: "/admin/sales" },
    { label: "Commerce", path: "/admin/commerce" },
    { label: "Cobrança", path: "/admin/recovery" },
    { label: "Contatos", path: "/admin/contacts" },
    { label: "Prospecção", path: "/admin/prospecting" },
    { label: "Agendamento", path: "/admin/scheduling" },
    { label: "AI", path: "/admin/ai" },
    { label: "Social", path: "/admin/social" },
    { label: "Catálogo", path: "/admin/catalog" },
    { label: "Estoque", path: "/admin/inventory" },
    { label: "Propostas", path: "/admin/proposals" },
    { label: "Pagamentos", path: "/admin/payment" },
    { label: "Auth", path: "/admin/auth" },
    { label: "Suporte", path: "/admin/support" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">AtendeAi Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname.startsWith(item.path)
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-gray-600"
            onClick={() => {
              clearApiKey();
              window.location.href = "/admin";
            }}
          >
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
