import { useState, useEffect } from "react";
import { Plane, Plus } from "lucide-react";
import { getFlights, createFlight } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function FlightsPage() {
  const isStaff = localStorage.getItem("role") === "staff";
  
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadFlights = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFlights();
      setFlights(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load flights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlights();
  }, []);

  const handleCreateFlight = async () => {
    setCreating(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await createFlight({
        flight_no: `AL-${Math.floor(100 + Math.random() * 900)}`,
        origin: "CMB",
        destination: "DXB",
        total_seats: 100,
        price: "320.00",
      });
      setSuccessMsg(data.message || "Flight created successfully");
      loadFlights();
    } catch (err) {
      setError(err.message || "Failed to create flight");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Flights</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage available AeroLink flights.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadFlights}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Refresh
          </button>
          {isStaff && (
            <button 
              onClick={handleCreateFlight}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70"
            >
              {creating ? <LoadingSpinner size="sm" label="" /> : <Plus className="h-4 w-4" />}
              New Flight
            </button>
          )}
        </div>
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

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading flights..." />
          </div>
        ) : flights.length === 0 ? (
          <EmptyState 
            icon={Plane} 
            title="No flights found" 
            description={isStaff ? "Create a new flight to get started." : "Check back later for available routes."} 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Flight No</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Route</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Seats</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {flights.map((flight) => (
                  <tr key={flight.flight_id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      {flight.flight_no}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {flight.origin} → {flight.destination}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {flight.available_seats} / {flight.total_seats}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 font-mono text-xs">
                      {flight.flight_id}
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
