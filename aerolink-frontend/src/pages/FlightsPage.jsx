import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plane, Plus, Search, Filter, AlertCircle, CheckCircle2, Ticket, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { getFlights, createFlight } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";

// Shared AvailabilityBadge component for flights
const AvailabilityBadge = ({ status }) => {
  if (status === "Available") return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Available</span>;
  if (status === "Limited Seats") return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Limited Seats</span>;
  if (status === "Sold Out") return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Sold Out</span>;
  return null;
};

export default function FlightsPage() {
  const isStaff = localStorage.getItem("role") === "staff";
  const isPassenger = localStorage.getItem("role") === "passenger";
  const navigate = useNavigate();
  
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form states
  const [newFlightNo, setNewFlightNo] = useState("");
  const [newOrigin, setNewOrigin] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newSeats, setNewSeats] = useState("");

  // Filter/Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState("FLIGHT_NO");

  const loadFlights = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFlights();
      const rawFlights = Array.isArray(data) ? data : (data.items || []);
      const normalizedFlights = rawFlights.map((flight) => {
        const avail = Number(flight.available_seats || 0);
        const total = Number(flight.total_seats || flight.available_seats || 0);
        
        let status = "Available";
        if (total > 0 && avail === 0) status = "Sold Out";
        else if (total > 0 && avail / total <= 0.2) status = "Limited Seats";

        return {
          ...flight,
          flight_id: flight.flight_id || flight.id,
          flight_no: flight.flight_no || flight.flight_number,
          origin: flight.origin,
          destination: flight.destination,
          price: Number(flight.price || 0),
          available_seats: avail,
          total_seats: total,
          availability_status: status
        };
      });
      setFlights(normalizedFlights);
    } catch (err) {
      setError(err.message || "Failed to load flights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlights();
  }, []);

  const handleBookFlight = (flight) => {
    navigate("/dashboard/bookings", { state: { selectedFlight: flight } });
  };

  const handleCreateFlight = async (e) => {
    e.preventDefault();
    if (!newFlightNo || !newOrigin || !newDestination || !newPrice || !newSeats) return;
    setCreating(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await createFlight(newFlightNo, newOrigin, newDestination, parseFloat(newPrice), parseInt(newSeats, 10));
      setSuccessMsg(`Flight ${data.flight_no || data.flight_number} created successfully.`);
      setNewFlightNo("");
      setNewOrigin("");
      setNewDestination("");
      setNewPrice("");
      setNewSeats("");
      setIsCreateModalOpen(false);
      loadFlights();
    } catch (err) {
      setError(err.message || "Failed to create flight");
    } finally {
      setCreating(false);
    }
  };

  // ── COMPUTATIONS ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalSeats = 0;
    let availableSeats = 0;
    let totalPrice = 0;
    let lowAvailabilityCount = 0;

    flights.forEach(f => {
      availableSeats += f.available_seats;
      totalSeats += f.total_seats;
      totalPrice += f.price;
      if (f.availability_status === "Sold Out" || f.availability_status === "Limited Seats") {
        lowAvailabilityCount++;
      }
    });

    const avgFare = flights.length > 0 ? (totalPrice / flights.length).toFixed(2) : 0;

    return {
      totalFlights: flights.length,
      availableSeats,
      avgFare,
      lowAvailabilityCount
    };
  }, [flights]);

  const filteredAndSortedFlights = useMemo(() => {
    let result = flights.filter(f => {
      const matchSearch = 
        (f.flight_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.origin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.destination || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = availabilityFilter === "ALL" || f.availability_status === availabilityFilter;
      return matchSearch && matchStatus;
    });

    result.sort((a, b) => {
      if (sortOption === "PRICE_ASC") return a.price - b.price;
      if (sortOption === "SEATS_DESC") return b.available_seats - a.available_seats;
      // FLIGHT_NO (default)
      return (a.flight_no || "").localeCompare(b.flight_no || "");
    });

    return result;
  }, [flights, searchTerm, availabilityFilter, sortOption]);

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isStaff ? "Flight Manager" : "Find Flights"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isStaff ? "Create and monitor available routes, fares and seat capacity." : "View and manage available AeroLink flights."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadFlights}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {isStaff && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" /> Create Flight
            </button>
          )}
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-100 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-100 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Staff Metrics */}
      {isStaff && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Flights" value={stats.totalFlights} icon={Plane} colorClass="text-slate-600" bgClass="bg-slate-100" />
          <StatCard title="Available Seats" value={stats.availableSeats} icon={Users} colorClass="text-sky-600" bgClass="bg-sky-50" />
          <StatCard title="Average Fare" value={`$${stats.avgFare}`} icon={Ticket} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <StatCard title="Low Availability" value={stats.lowAvailabilityCount} icon={AlertTriangle} colorClass="text-amber-600" bgClass="bg-amber-50" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm ring-1 ring-slate-200">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search flight number or route"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-48 flex-shrink-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            >
              <option value="ALL">All Availability</option>
              <option value="Available">Available</option>
              <option value="Limited Seats">Limited Seats</option>
              <option value="Sold Out">Sold Out</option>
            </select>
          </div>
          <div className="relative w-full sm:w-48 flex-shrink-0">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
            >
              <option value="FLIGHT_NO">Sort: Flight Number</option>
              <option value="PRICE_ASC">Sort: Price (Low to High)</option>
              <option value="SEATS_DESC">Sort: Most Seats Available</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flight List */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner label="Loading flights..." />
          </div>
        ) : filteredAndSortedFlights.length === 0 ? (
          <EmptyState 
            icon={Plane} 
            title="No flights found" 
            description={isStaff ? "Create a new flight to get started or adjust your filters." : "Check back later for available routes."} 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Flight No</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Route</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Fare</th>
                  {isStaff && <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Total Seats</th>}
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Available</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Availability</th>
                  {isPassenger && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredAndSortedFlights.map((flight) => (
                  <tr key={flight.flight_id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-slate-900 font-mono sm:pl-6">
                      {flight.flight_no}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-medium">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 mr-2">{flight.origin}</span>
                      → 
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ml-2">{flight.destination}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900">
                      ${flight.price.toFixed(2)}
                    </td>
                    {isStaff && (
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {flight.total_seats}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-medium">
                      {flight.available_seats}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <AvailabilityBadge status={flight.availability_status} />
                    </td>
                    {isPassenger && (
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleBookFlight(flight)}
                          disabled={flight.available_seats === 0}
                          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-sky-600 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:text-slate-400"
                        >
                          Book<span className="sr-only">, {flight.flight_no}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Flight Modal (Staff Only) */}
      {isStaff && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => !creating && setIsCreateModalOpen(false)}
          title="Create New Flight"
        >
          <div className="mb-5 text-sm text-slate-500">
            Add a new route with fare and seat capacity.
          </div>
          <form onSubmit={handleCreateFlight} className="space-y-4">
            <div>
              <label htmlFor="flightNo" className="block text-sm font-medium leading-6 text-slate-900">Flight Number</label>
              <input
                type="text"
                id="flightNo"
                required
                value={newFlightNo}
                onChange={(e) => setNewFlightNo(e.target.value)}
                placeholder="e.g. AL-505"
                className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="origin" className="block text-sm font-medium leading-6 text-slate-900">Origin</label>
                <input
                  type="text"
                  id="origin"
                  required
                  maxLength={3}
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  placeholder="LHR"
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 uppercase"
                />
              </div>
              <div>
                <label htmlFor="destination" className="block text-sm font-medium leading-6 text-slate-900">Destination</label>
                <input
                  type="text"
                  id="destination"
                  required
                  maxLength={3}
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  placeholder="JFK"
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className="block text-sm font-medium leading-6 text-slate-900">Price</label>
                <input
                  type="number"
                  id="price"
                  required
                  min="1"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="e.g. 450.00"
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                />
              </div>
              <div>
                <label htmlFor="seats" className="block text-sm font-medium leading-6 text-slate-900">Total Seats</label>
                <input
                  type="number"
                  id="seats"
                  required
                  min="1"
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  placeholder="e.g. 150"
                  className="mt-2 block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={creating}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newFlightNo || !newOrigin || !newDestination || !newPrice || !newSeats}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
              >
                {creating ? <LoadingSpinner size="sm" label="" /> : "Create Flight"}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
