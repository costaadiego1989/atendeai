import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setApiKey } from "@/services/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key.trim()) {
      setError("Informe a chave de acesso");
      return;
    }

    // Validate key by making a test request
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"}/platform/support/feedbacks?limit=1`,
        { headers: { "x-platform-admin-key": key.trim() } },
      );

      if (res.status === 401) {
        setError("Chave inválida");
        return;
      }

      setApiKey(key.trim());
      navigate("/admin/support");
    } catch {
      setError("Erro ao conectar com a API");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Admin AtendeAi</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
              Chave de Acesso
            </label>
            <Input
              id="apiKey"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Insira a API key do platform admin"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
