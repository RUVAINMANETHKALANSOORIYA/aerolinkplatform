import { useState } from "react";
import { AlertCircle } from "lucide-react";

const ROWS = 12;
const SEATS_PER_ROW = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function SeatSelector({ selectedSeats, onChange, availableSeats, maxSelectableSeats = 10 }) {
  const [warning, setWarning] = useState("");

  const actualMax = Math.min(availableSeats, maxSelectableSeats);

  const toggleSeat = (seatId) => {
    if (selectedSeats.includes(seatId)) {
      setWarning("");
      onChange(selectedSeats.filter(s => s !== seatId));
    } else {
      if (selectedSeats.length >= actualMax) {
        setWarning(`You can select up to ${actualMax} seat${actualMax !== 1 ? 's' : ''} per booking.`);
        setTimeout(() => setWarning(""), 3000);
        return;
      }
      setWarning("");
      onChange([...selectedSeats, seatId]);
    }
  };

  const rows = Array.from({ length: ROWS }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
      <div className="w-full bg-slate-800 text-white text-center py-3 rounded-t-3xl rounded-b-md mb-8 font-semibold tracking-widest shadow-inner">
        FRONT
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(row => (
          <div key={row} className="flex items-center gap-4 sm:gap-6">
            <span className="w-6 text-right text-sm font-semibold text-slate-400 select-none">
              {row}
            </span>
            
            {/* Left side (A,B,C) */}
            <div className="flex gap-2">
              {SEATS_PER_ROW.slice(0, 3).map(letter => {
                const seatId = `${row}${letter}`;
                const isSelected = selectedSeats.includes(seatId);
                return (
                  <button
                    key={seatId}
                    type="button"
                    onClick={() => toggleSeat(seatId)}
                    className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500
                      ${isSelected 
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-md transform scale-105" 
                        : "bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300"
                      }`}
                    title={`Seat ${seatId}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Aisle */}
            <div className="w-4 sm:w-8 text-center text-xs text-slate-300 select-none">
              
            </div>

            {/* Right side (D,E,F) */}
            <div className="flex gap-2">
              {SEATS_PER_ROW.slice(3, 6).map(letter => {
                const seatId = `${row}${letter}`;
                const isSelected = selectedSeats.includes(seatId);
                return (
                  <button
                    key={seatId}
                    type="button"
                    onClick={() => toggleSeat(seatId)}
                    className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500
                      ${isSelected 
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-md transform scale-105" 
                        : "bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300"
                      }`}
                    title={`Seat ${seatId}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full bg-slate-100 text-slate-400 text-center py-2 rounded-b-3xl rounded-t-md mt-8 font-semibold tracking-widest text-xs border border-slate-200">
        REAR
      </div>

      {warning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm whitespace-nowrap z-10 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
          <AlertCircle className="h-4 w-4" />
          {warning}
        </div>
      )}
    </div>
  );
}
