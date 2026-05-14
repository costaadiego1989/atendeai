import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FeedbackDetailDrawer from "./FeedbackDetailDrawer";

interface Feedback {
  id: string;
  tenantId: string;
  tenantName?: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  title: string;
  description: string;
  status: string;
  appModule?: string;
  createdAt: string;
}

interface FeedbacksResponse {
  data: Feedback[];
  total: number;
}

const typeBadgeColors: Record<string, string> = {
  BUG: "bg-red-100 text-red-800",
  SUGGESTION: "bg-blue-100 text-blue-800",
  IMPROVEMENT: "bg-green-100 text-green-800",
};

const statusBadgeColors: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  REVIEWED: "bg-purple-100 text-purple-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export default function SupportFeedbacksPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const limit = 20;

  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (typeFilter !== "ALL") queryParams.set("type", typeFilter);
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);

  const { data, isLoading, refetch } = useQuery<FeedbacksResponse>({
    queryKey: ["admin-feedbacks", page, typeFilter, statusFilter],
    queryFn: () => adminFetch(`/platform/support/feedbacks?${queryParams.toString()}`),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suporte — Feedbacks</h1>
        <span className="text-sm text-gray-500">
          {data?.total ?? 0} feedbacks
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="SUGGESTION">Sugestão</SelectItem>
            <SelectItem value="IMPROVEMENT">Melhoria</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="OPEN">Aberto</SelectItem>
            <SelectItem value="REVIEWED">Revisado</SelectItem>
            <SelectItem value="CLOSED">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : !data?.data.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhum feedback encontrado
                </td>
              </tr>
            ) : (
              data.data.map((fb) => (
                <tr
                  key={fb.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedFeedbackId(fb.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[250px] truncate">
                    {fb.title}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={typeBadgeColors[fb.type] || "bg-gray-100"}>
                      {fb.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusBadgeColors[fb.status] || "bg-gray-100"}>
                      {fb.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fb.userName}</td>
                  <td className="px-4 py-3 text-gray-600">{fb.tenantName || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(fb.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedFeedbackId && (
        <FeedbackDetailDrawer
          feedbackId={selectedFeedbackId}
          onClose={() => {
            setSelectedFeedbackId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
