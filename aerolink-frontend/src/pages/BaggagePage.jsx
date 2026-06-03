import { useState, useEffect } from "react";
import { Luggage, Save, Plus } from "lucide-react";
import { getMyBaggage, getAllBaggage, createBaggage, updateBaggageStatus } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";

const VALID_STATUSES = ["CHECKED_IN", "SCREENED", "LOADED", "IN_TRANSIT", "ARRIVED", "COLLECTED", "DELAYED"];

export default function BaggagePage() {
  const isStaff = localStorage.getItem("role") === "staff";
  
  const [bags, setBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Registration form state (Staff only)
  const [creating, setCreating] = useState(false);
  const [regBookingId, setRegBookingId] = useState("");
  const [regTagNumber, setRegTagNumber] = useState("");
  const [regWeight, setRegWeight] = useState("");

  // Update form state (Staff only)
  const [updating, setUpdating] = useState(false);
  const [updateId, setUpdateId] = useState("");
  const [updateStatus, setUpdateStatus] = useState("CHECKED_IN");

  const loadBaggage = async () => {
    setLoading(true);
    setError("");
    try {
      const data = isStaff ? await getAllBaggage() : await getMyBaggage();
      setBags(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load baggage records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaggage();
  }, [isStaff]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regBookingId || !regTagNumber) return;

    setCreating(true);
    setError("");
    setSuccessMsg("");
    try {
      await createBaggage(regBookingId, regTagNumber, regWeight);
      setSuccessMsg("Baggage registered successfully.");
      setRegBookingId("");
      setRegTagNumber("");
      setRegWeight("");
      loadBaggage();
    } catch (err) {
      setError(err.message || "Failed to register baggage");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateId || !updateStatus) return;

    setUpdating(true);
    setError("");
    setSuccessMsg("");
    try {
      await updateBaggageStatus(updateId, updateStatus);
      setSuccessMsg("Baggage status updated.");
      setUpdateId("");
      setUpdateStatus("CHECKED_IN");
      loadBaggage();
    } catch (err) {
      setError(err.message || "Failed to update baggage status");
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
            <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Register Baggage</h3>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-700">Booking ID</label>
                <input
                  type="text"
                  required
                  value={regBookingId}
                  onChange={(e) => setRegBookingId(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-700">Tag Number</label>
                <input
                  type="text"
                  required
                  value={regTagNumber}
                  onChange={(e) => setRegTagNumber(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-700">Weight (kg) - Optional</label>
                <input
                  type="number"
                  step="0.1"
                  value={regWeight}
                  onChange={(e) => setRegWeight(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !regBookingId || !regTagNumber}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70"
              >
                {creating ? <LoadingSpinner size="sm" label="" /> : <Plus className="h-4 w-4" />}
                Register
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
            <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Update Status</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-700">Baggage ID</label>
                <input
                  type="text"
                  required
                  value={updateId}
                  onChange={(e) => setUpdateId(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-700">New Status</label>
                <select
                  required
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  {VALID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={updating || !updateId}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70"
              >
                {updating ? <LoadingSpinner size="sm" label="" /> : <Save className="h-4 w-4" />}
                Update Status
              </button>
            </form>
          </div>
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
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Tag Number{isStaff ? " / ID" : ""}</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Flight Route</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Weight</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bags.map((bag, i) => (
                  <tr key={bag.id || i} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      <div className="flex flex-col">
                        <span>{bag.tag_number || "No tag"}</span>
                        {isStaff && <span className="text-xs text-slate-400 font-mono mt-0.5">{bag.id || bag.baggage_id}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={bag.status || "UNKNOWN"} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.flight_no} {bag.origin && bag.destination ? `(${bag.origin} to ${bag.destination})` : ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.weight_kg ? `${bag.weight_kg} kg` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {bag.updated_at || bag.last_updated ? new Date(bag.updated_at || bag.last_updated).toLocaleString() : "-"}
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
