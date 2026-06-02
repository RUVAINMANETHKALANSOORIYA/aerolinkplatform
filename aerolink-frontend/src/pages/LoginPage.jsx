import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Plane, AlertCircle } from "lucide-react";
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
    <div className="flex min-h-screen bg-white">
      {/* Left pane - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3 font-bold text-2xl tracking-wide">
            <Plane className="h-8 w-8 text-blue-500" />
            AeroLink
          </div>
          <p className="mt-4 text-slate-400 max-w-md text-lg">
            Connected journeys. Smarter operations.
          </p>
        </div>
        
        <div className="space-y-8">
          <div className="max-w-md">
            <h3 className="text-xl font-semibold mb-2">Cloud-Native Scale</h3>
            <p className="text-slate-400">Built on modern serverless and container infrastructure for global reliability.</p>
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-semibold mb-2">Secure by Design</h3>
            <p className="text-slate-400">Enterprise-grade authentication and strict role-based access controls.</p>
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-semibold mb-2">Real-Time Operations</h3>
            <p className="text-slate-400">Event-driven architecture powering instant updates across all services.</p>
          </div>
        </div>
      </div>

      {/* Right pane - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100">
          
          <div className="lg:hidden flex items-center justify-center gap-2 font-bold text-2xl mb-8 text-slate-900">
            <Plane className="h-8 w-8 text-blue-600" />
            AeroLink
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">
              Access the passenger or staff portal.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-100">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium leading-6 text-slate-900">
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
                  className="block w-full rounded-lg border-0 py-2.5 px-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-900">
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
                  className="block w-full rounded-lg border-0 py-2.5 px-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <LoadingSpinner size="sm" label="" /> : "Sign in to account"}
            </button>
          </form>
          
          <p className="text-center text-xs text-slate-400 mt-8">
            Secured by Amazon Cognito
          </p>
        </div>
      </div>
    </div>
  );
}
