import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ticket, Plus, CheckCircle2, Clock, AlertTriangle, Search, Filter, Copy, Check } from "lucide-react";
import { getBookings, createBooking, createPayment } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import StatCard from "../components/StatCard.jsx";

export default function BookingsPage() {
  const isPassenger = localStorage.getItem("role") === "passenger";
  const isStaff = localStorage.getItem("role") === "staff";
  const username = localStorage.getItem("username") || "Passenger";
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(location.state?.selectedFlight || null);
  const [seatCount, setSeatCount] = useState("1");
  const [passengerName, setPassengerName] = useState(username);
  
  const [payingBooking, setPayingBooking] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Staff filters & UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  const handlePayment = async (result) => {
    setPaymentProcessing(true);
    setError("");
    try {
      await createPayment(payingBooking.id, result);
      setPayingBooking(null);
      loadBookings();
    } catch (err) {
      setError(err.message || "Payment simulation failed");
    } finally {
      setPaymentProcessing(false);
    }
  };

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
  }, [isPassenger]);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!selectedFlight || !seatCount || !passengerName) return;

    setCreating(true);
    setError("");
    try {
      await createBooking(passengerName, selectedFlight.flight_id, parseInt(seatCount, 10));
      setSelectedFlight(null); // Reset after booking
      loadBookings();
    } catch (err) {
      setError(err.message || "Failed to create booking");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegisterBaggage = (booking) => {
    navigate("/dashboard/baggage", {
      state: {
        bookingForBaggage: {
          id: booking.id,
          flight_no: booking.flight_no,
          origin: booking.origin,
          destination: booking.destination,
          passenger_name: booking.passenger_name
        }
      }
    });
  };

  const filteredBookings = useMemo(() => {
    if (!isStaff) return bookings;
    return bookings.filter(b => {
      const matchSearch = 
        (b.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.passenger_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.flight_no || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookings, searchTerm, statusFilter, isStaff]);

  const stats = useMemo(() => {
    if (!isStaff) return null;
    return {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === "CONFIRMED").length,
      pending: bookings.filter(b => b.status === "PENDING_PAYMENT").length,
      failed: bookings.filter(b => b.status === "PAYMENT_FAILED").length,
    };
  }, [bookings, isStaff]);

  // ── STAFF VIEW ─────────────────────────────────────────────────────────────
  if (isStaff) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Passenger Bookings</h1>
            <p className="mt-1 text-sm text-slate-500">Review passenger reservations and register baggage for confirmed journeys.</p>
          </div>
          <button 
            onClick={loadBookings}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 self-start sm:self-auto"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Bookings" value={stats.total} icon={Ticket} colorClass="text-slate-600" bgClass="bg-slate-100" />
            <StatCard title="Confirmed" value={stats.confirmed} icon={CheckCircle2} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            <StatCard title="Pending Payment" value={stats.pending} icon={Clock} colorClass="text-amber-600" bgClass="bg-amber-50" />
            <StatCard title="Payment Failed" value={stats.failed} icon={AlertTriangle} colorClass="text-red-600" bgClass="bg-red-50" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm ring-1 ring-slate-200">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search booking ID, passenger name or flight number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            />
          </div>
          <div className="relative w-full sm:w-64 flex-shrink-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING_PAYMENT">Pending Payment</option>
              <option value="PAYMENT_FAILED">Payment Failed</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner label="Loading bookings..." />
            </div>
          ) : filteredBookings.length === 0 ? (
            <EmptyState 
              icon={Ticket} 
              title="No bookings found" 
              description="Adjust your search filters or wait for new reservations." 
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Booking ID</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Passenger Name</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Flight</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Route</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Seats</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Total Amount</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{booking.id}</span>
                          <button
                            onClick={() => handleCopyId(booking.id)}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                            title="Copy ID"
                          >
                            {copiedId === booking.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-900 font-medium">
                        {booking.passenger_name || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 font-semibold">
                        {booking.flight_no}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 text-xs">
                        {booking.origin && booking.destination ? `${booking.origin} → ${booking.destination}` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                        {booking.seat_count || 1}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900">
                        {booking.total_amount != null ? `$${Number(booking.total_amount || 0).toFixed(2)}` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                        {booking.status === "CONFIRMED" ? (
                          <button 
                            onClick={() => handleRegisterBaggage(booking)}
                            className="text-sky-600 hover:text-sky-800 font-semibold"
                          >
                            Register Baggage
                          </button>
                        ) : booking.status === "PENDING_PAYMENT" ? (
                          <span className="text-slate-400">Awaiting Payment</span>
                        ) : booking.status === "PAYMENT_FAILED" ? (
                          <span className="text-slate-400">Payment Failed</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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

  // ── PASSENGER VIEW ─────────────────────────────────────────────────────────
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

      {isPassenger && payingBooking && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
          <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Complete Payment</h3>
          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mb-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-slate-900">{payingBooking.flight_no}</h4>
              <span className="text-sm font-medium text-slate-700">${Number(payingBooking.total_amount || 0).toFixed(2)} Total</span>
            </div>
            <div className="text-sm text-slate-600 mb-1">{payingBooking.origin} → {payingBooking.destination}</div>
            <div className="text-xs text-slate-500">{payingBooking.seat_count} seats booked</div>
          </div>
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200 mb-4">
            Simulation only — no real payment details are collected.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setPayingBooking(null)} disabled={paymentProcessing} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Cancel</button>
            <button onClick={() => handlePayment("FAILED")} disabled={paymentProcessing} className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100">Simulate Failed Payment</button>
            <button onClick={() => handlePayment("SUCCESS")} disabled={paymentProcessing} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
              {paymentProcessing ? <LoadingSpinner size="sm" label="" /> : "Simulate Successful Payment"}
            </button>
          </div>
        </div>
      )}

      {isPassenger && !payingBooking && (
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
                  <h4 className="font-semibold text-slate-900">{selectedFlight.flight_no}</h4>
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
                  {isPassenger && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
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
                      {booking.total_amount != null ? `$${Number(booking.total_amount || 0).toFixed(2)}` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <StatusBadge status={booking.status} />
                    </td>
                    {isPassenger && (
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {booking.status === "PENDING_PAYMENT" && (
                          <button onClick={() => setPayingBooking(booking)} className="text-blue-600 hover:text-blue-900 font-semibold">Pay Now</button>
                        )}
                      </td>
                    )}
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
