import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Ticket, Plus } from "lucide-react";
import { getBookings, createBooking } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function BookingsPage() {
  const isPassenger = localStorage.getItem("role") === "passenger";
  const username = localStorage.getItem("username") || "Passenger";
  
  const location = useLocation();
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(location.state?.selectedFlight || null);
  const [seatCount, setSeatCount] = useState("1");
  const [passengerName, setPassengerName] = useState(username);

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getBookings(isPassenger);
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
    if (!selectedFlight || !seatCount || !passengerName) return;

    setCreating(true);
    setError("");
    try {
      await createBooking(passengerName, selectedFlight.id, parseInt(seatCount, 10));
      setSelectedFlight(null); // Reset after booking
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
          {!selectedFlight ? (
            <div className="text-sm text-slate-500 mb-4">
              Please select a flight from the <a href="/flights" className="text-blue-600 hover:underline">Available Flights</a> page to make a booking.
            </div>
          ) : (
            <form onSubmit={handleCreateBooking} className="flex flex-col gap-4">
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-slate-900">{selectedFlight.flight_number}</h4>
                  <span className="text-sm font-medium text-slate-700">${selectedFlight.price} / seat</span>
                </div>
                <div className="text-sm text-slate-600 mb-1">{selectedFlight.origin} → {selectedFlight.destination}</div>
                <div className="text-xs text-slate-500">{selectedFlight.available_seats} seats available</div>
              </div>
              
              <div className="flex gap-4 flex-wrap items-end">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="passengerName" className="block text-sm font-medium leading-6 text-slate-700">Passenger Name</label>
                  <input
                    type="text"
                    id="passengerName"
                    required
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  />
                </div>
                <div className="w-24">
                  <label htmlFor="seatCount" className="block text-sm font-medium leading-6 text-slate-700">Seats</label>
                  <input
                    type="number"
                    id="seatCount"
                    required
                    min="1"
                    max={selectedFlight.available_seats}
                    value={seatCount}
                    onChange={(e) => setSeatCount(e.target.value)}
                    className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-900 flex justify-between items-center border border-blue-100">
                <span>Estimated Total:</span>
                <span className="font-bold text-lg">${(parseFloat(selectedFlight.price || 0) * parseInt(seatCount || 0, 10)).toFixed(2)}</span>
              </div>
              <p className="text-xs text-slate-500 italic">Final amount is confirmed when the booking is created.</p>

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFlight(null)}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !seatCount || !passengerName}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70"
                >
                  {creating ? <LoadingSpinner size="sm" label="" /> : <Plus className="h-4 w-4" />}
                  Confirm Booking
                </button>
              </div>
            </form>
          )}
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
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Booking ID</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Flight Route</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Seats</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Total</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 font-mono text-xs sm:pl-6">
                      {booking.id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      <div className="font-semibold">{booking.flight_no}</div>
                      {booking.origin && booking.destination && <div className="text-xs text-slate-500">{booking.origin} → {booking.destination}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      {booking.seat_count || 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900">
                      {booking.total_amount ? `$${booking.total_amount.toFixed(2)}` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={booking.status} />
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
