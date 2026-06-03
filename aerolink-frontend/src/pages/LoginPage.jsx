import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Plane, AlertCircle, ShieldCheck, Zap, Cloud } from "lucide-react";
import { cognitoLogin, getStoredAccessToken } from "../auth.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already logged in, redirect to dashboard
  if (getStoredAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await cognitoLogin(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden font-sans">
      <style>
        {`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            opacity: 0;
            animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          
          @keyframes floatPlane {
            0%, 100% { transform: translateY(0) rotate(15deg); }
            50% { transform: translateY(-12px) rotate(15deg); }
          }
          .animate-float-plane {
            animation: floatPlane 5s ease-in-out infinite;
            transform-origin: center;
          }
          
          @keyframes dashFlow {
            from { stroke-dashoffset: 24; }
            to { stroke-dashoffset: 0; }
          }
          .animate-dash-flow {
            stroke-dasharray: 6 6;
            animation: dashFlow 2s linear infinite;
          }
          
          @keyframes pulsePoint {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.8); opacity: 0.1; }
          }
          .animate-pulse-point {
            animation: pulsePoint 3s ease-in-out infinite;
            transform-origin: center;
          }
          
          @keyframes ambientGlow {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
          }
          .animate-ambient-glow {
            animation: ambientGlow 8s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .animate-fade-in-up {
              animation: none;
              opacity: 1;
              transform: none;
            }
            .animate-float-plane, .animate-dash-flow, .animate-pulse-point, .animate-ambient-glow {
              animation: none !important;
            }
          }
        `}
      </style>

      {/* Left pane - Animated Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Subtle background effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-sky-600/20 blur-[120px] rounded-full animate-ambient-glow"></div>
          <div className="absolute top-[40%] -right-[20%] w-[60%] h-[60%] bg-indigo-600/20 blur-[100px] rounded-full animate-ambient-glow" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 font-bold text-3xl tracking-tight">
            <div className="bg-sky-500/20 p-2 rounded-xl backdrop-blur-sm border border-sky-400/20">
              <Plane className="h-8 w-8 text-sky-400" />
            </div>
            AeroLink
          </div>
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Cloud Platform
          </h1>
          <p className="mt-4 text-sky-100 max-w-md text-xl font-medium leading-relaxed">
            Seamless journeys. Secure operations. Connected travel.
          </p>
          
          {/* Trust Labels */}
          <div className="flex flex-wrap gap-3 mt-8">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold tracking-wide text-slate-200">Secure Sign In</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold tracking-wide text-slate-200">Real-Time Updates</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              <Cloud className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-semibold tracking-wide text-slate-200">Cloud Powered</span>
            </div>
          </div>
        </div>

        {/* Animated Flight Path Graphic */}
        <div className="relative z-10 w-full max-w-lg mt-auto mb-12">
          <svg viewBox="0 0 400 150" className="w-full h-auto drop-shadow-2xl overflow-visible" preserveAspectRatio="xMidYMid meet">
            {/* Route Line */}
            <path 
              d="M 20 120 Q 200 10 380 120" 
              fill="none" 
              stroke="rgba(125, 211, 252, 0.3)" 
              strokeWidth="2" 
              className="animate-dash-flow" 
            />
            
            {/* Origin Point */}
            <circle cx="20" cy="120" r="6" fill="#38bdf8" className="animate-pulse-point" />
            <circle cx="20" cy="120" r="2" fill="#fff" />
            
            {/* Destination Point */}
            <circle cx="380" cy="120" r="6" fill="#34d399" className="animate-pulse-point" style={{ animationDelay: "1.5s" }} />
            <circle cx="380" cy="120" r="2" fill="#fff" />

            {/* Moving Airplane near the apex */}
            <g className="animate-float-plane" transform="translate(190, 50)">
              {/* Airplane Icon drawn via SVG path */}
              <path 
                d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.7l-1.3 2.6c-.2.4-.1 1 .3 1.3L9 14l-4.5 4.5-2.8-.7c-.4-.1-.8.1-1 .5L0 19.5c-.2.4 0 .9.4 1.1l3.8 2 2 3.8c.2.4.7.6 1.1.4l1.2-.7c.4-.2.6-.6.5-1l-.7-2.8L10 15l3.2 6.3c.3.4.9.5 1.3.3l2.6-1.3c.5-.2.8-.6.7-1.1z" 
                fill="#fff" 
                transform="rotate(60 12 12)" 
                style={{ filter: "drop-shadow(0px 10px 8px rgba(0,0,0,0.3))" }}
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Right pane - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 animate-fade-in-up">
          
          <div className="text-center">
            <div className="mx-auto h-14 w-14 bg-sky-50 rounded-2xl flex items-center justify-center mb-6 lg:hidden ring-1 ring-inset ring-sky-100">
              <Plane className="h-7 w-7 text-sky-600" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              Sign in to continue your AeroLink journey.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-100 animate-fade-in-up" style={{ animationDuration: '0.4s' }}>
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6 mt-8">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold leading-6 text-slate-900">
                Username
              </label>
              <div className="mt-2">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 transition-shadow"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold leading-6 text-slate-900">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 transition-shadow"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center items-center gap-2 rounded-lg bg-sky-600 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? <LoadingSpinner size="sm" label="" /> : "Sign In"}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-center text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by Amazon Cognito
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
