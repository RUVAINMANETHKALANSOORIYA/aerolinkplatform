import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plane, Plus } from "lucide-react";
import { getFlights, createFlight } from "../services/api.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function FlightsPage() {
  const isStaff = localStorage.getItem("role") === "staff";
  const isPassenger = localStorage.getItem("role") === "passenger";
  const navigate = useNavigate();
  
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [newFlightNo, setNewFlightNo] = useState("");
  const [newOrigin, setNewOrigin] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newSeats, setNewSeats] = useState("");

  const loadFlights = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFlights();
      const rawFlights = Array.isArray(data) ? data : (data.items || []);
      const normalizedFlights = rawFlights.map((flight) => ({
        ...flight,
        flight_id: flight.flight_id || flight.id,
        flight_no: flight.flight_no || flight.flight_number,
        origin: flight.origin,
        destination: flight.destination,
        price: Number(flight.price || 0),
        available_seats: Number(flight.available_seats || 0),
        total_seats: Number(flight.total_seats || flight.available_seats || 0)
      }));
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
    navigate("/bookings", { state: { selectedFlight: flight } });
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

      {isStaff && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6">
          <h3 className="text-base font-semibold leading-6 text-slate-900 mb-4">Create New Flight</h3>
          <form onSubmit={handleCreateFlight} className="flex gap-3 items-end flex-wrap">
            <div className="w-full sm:flex-1 max-w-xs">
              <label htmlFor="flightNo" className="block text-sm font-medium leading-6 text-slate-700">
                Flight Number
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="flightNo"
                  required
                  value={newFlightNo}
                  onChange={(e) => setNewFlightNo(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="e.g. AL-404"
                />
              </div>
            </div>
            <div className="w-full sm:flex-1 max-w-[100px]">
              <label htmlFor="origin" className="block text-sm font-medium leading-6 text-slate-700">
                Origin
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="origin"
                  required
                  maxLength={3}
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 uppercase"
                  placeholder="LHR"
                />
              </div>
            </div>
            <div className="w-full sm:flex-1 max-w-[100px]">
              <label htmlFor="destination" className="block text-sm font-medium leading-6 text-slate-700">
                Dest
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="destination"
                  required
                  maxLength={3}
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 uppercase"
                  placeholder="JFK"
                />
              </div>
            </div>
            <div className="w-full sm:flex-1 max-w-[120px]">
              <label htmlFor="price" className="block text-sm font-medium leading-6 text-slate-700">
                Price
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  id="price"
                  required
                  min="1"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="e.g. 450"
                />
              </div>
            </div>
            <div className="w-full sm:flex-1 max-w-[120px]">
              <label htmlFor="seats" className="block text-sm font-medium leading-6 text-slate-700">
                Seats
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  id="seats"
                  required
                  min="1"
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="e.g. 150"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !newFlightNo || !newOrigin || !newDestination || !newPrice || !newSeats}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 h-10 w-full sm:w-auto mt-2 sm:mt-0 justify-center"
            >
              {creating ? <LoadingSpinner size="sm" label="" /> : <Plus className="h-4 w-4" />}
              Create Flight
            </button>
          </form>
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
                  {isPassenger && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
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
                      {flight.available_seats}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 font-mono text-xs">
                      {flight.flight_id}
                    </td>
                    {isPassenger && (
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleBookFlight(flight)}
                          className="text-blue-600 hover:text-blue-900 font-semibold"
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
    </div>
  );
}
