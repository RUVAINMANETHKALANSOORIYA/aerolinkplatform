import { useState, useEffect } from "react";
import { Activity, Server } from "lucide-react";
import { getHealth } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHealth = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      setError(err.message || "Failed to contact ECS API Gateway");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Health</h1>
          <p className="mt-1 text-sm text-slate-500">ECS Microservice connectivity status.</p>
        </div>
        <button 
          onClick={loadHealth}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 self-start sm:self-auto"
        >
          Check Again
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Pinging API Gateway..." />
          </div>
        ) : health ? (
          <div>
            <div className="border-b border-slate-200 p-6 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-white p-2 shadow-sm ring-1 ring-slate-200">
                  <Activity className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">API Gateway</h3>
                  <p className="text-sm text-slate-500">{health.timestamp}</p>
                </div>
              </div>
              <StatusBadge status={health.status} />
            </div>
            
            <div className="p-6">
              <h4 className="text-sm font-medium text-slate-900 mb-4 uppercase tracking-wider">Downstream Services</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(health.dependencies || {}).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{service}</span>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-900 p-6 text-slate-300 text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
