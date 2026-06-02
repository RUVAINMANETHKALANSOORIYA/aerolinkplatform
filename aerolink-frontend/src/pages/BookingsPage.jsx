import { useState, useEffect } from "react";
import { Ticket, Plus } from "lucide-react";
import { getBookings, createBooking } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function BookingsPage() {
  const isPassenger = localStorage.getItem("role") === "passenger";
  const username = localStorage.getItem("username") || "Passenger";
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [flightId, setFlightId] = useState("");

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getBookings();
      setBookings(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!flightId) return;

    setCreating(true);
    setError("");
    try {
      await createBooking(username, flightId);
      setFlightId("");
      loadBookings();
    } catch (err) {
      setError(err.message || "Failed to create booking");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage flight reservations and status.</p>
        </div>
        <button 
          onClick={loadBookings}
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

      {isPassenger && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
          <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Make a Booking</h3>
          <form onSubmit={handleCreateBooking} className="flex gap-3 items-end">
            <div className="flex-1 max-w-sm">
              <label htmlFor="flightId" className="block text-sm font-medium leading-6 text-slate-700">
                Flight ID
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="flightId"
                  required
                  value={flightId}
                  onChange={(e) => setFlightId(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="Enter flight ID to book"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !flightId}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 h-10"
            >
              {creating ? <LoadingSpinner size="sm" label="" /> : <Plus className="h-4 w-4" />}
              Book Flight
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading bookings..." />
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState 
            icon={Ticket} 
            title="No bookings found" 
            description="Reservations will appear here once created." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Passenger</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Flight ID</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Booking ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                      {booking.passenger_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-mono text-xs">
                      {booking.flight_id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 font-mono text-xs">
                      {booking.id}
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
