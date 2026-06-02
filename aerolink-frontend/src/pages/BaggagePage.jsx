import { useState, useEffect } from "react";
import { Luggage, Save } from "lucide-react";
import { getBaggage, updateBaggageStatus } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function BaggagePage() {
  const isStaff = localStorage.getItem("role") === "staff";
  
  const [bags, setBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateId, setUpdateId] = useState("");
  const [updateStatus, setUpdateStatus] = useState("LOADED");
  const [successMsg, setSuccessMsg] = useState("");

  const loadBaggage = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getBaggage();
      setBags(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load baggage records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaggage();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateId || !updateStatus) return;

    setUpdating(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await updateBaggageStatus(updateId, updateStatus);
      setSuccessMsg(data.message || "Baggage updated");
      setUpdateId("");
      loadBaggage();
    } catch (err) {
      setError(err.message || "Failed to update baggage");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Baggage</h1>
          <p className="mt-1 text-sm text-slate-500">Track and manage passenger luggage.</p>
        </div>
        <button 
          onClick={loadBaggage}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 self-start sm:self-auto"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100">
          {error}
        </div>
      )}
      
      {successMsg && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-100">
          {successMsg}
        </div>
      )}

      {isStaff && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
          <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Update Status</h3>
          <form onSubmit={handleUpdate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 max-w-sm">
              <label htmlFor="bagId" className="block text-sm font-medium leading-6 text-slate-700">
                Baggage ID
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="bagId"
                  required
                  value={updateId}
                  onChange={(e) => setUpdateId(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="ID string..."
                />
              </div>
            </div>
            
            <div className="w-full sm:w-48">
              <label htmlFor="status" className="block text-sm font-medium leading-6 text-slate-700">
                New Status
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="status"
                  required
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updating || !updateId}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 h-10 w-full sm:w-auto"
            >
              {updating ? <LoadingSpinner size="sm" label="" /> : <Save className="h-4 w-4" />}
              Update
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading baggage..." />
          </div>
        ) : bags.length === 0 ? (
          <EmptyState 
            icon={Luggage} 
            title="No baggage records found" 
            description="Bags registered to bookings will appear here." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Tag Number / ID</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Passenger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bags.map((bag) => (
                  <tr key={bag.baggage_id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      <div className="flex flex-col">
                        <span>{bag.tag_number || "No tag"}</span>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">{bag.baggage_id}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={bag.status || "UNKNOWN"} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.passenger_name || "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
