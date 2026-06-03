import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plane, AlertCircle } from "lucide-react";
import { cognitoSignUpPassenger } from "../auth.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await cognitoSignUpPassenger(email, password);
      if (result.userConfirmed) {
        setError("This account is already confirmed. Please sign in.");
      } else {
        navigate("/verify-email", { state: { email: email.trim().toLowerCase() } });
      }
    } catch (err) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout heroTitle="Begin your journey" heroSubtitle="Create your passenger account to book flights and track your travel updates.">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 bg-sky-50 rounded-2xl flex items-center justify-center mb-6 lg:hidden ring-1 ring-inset ring-sky-100">
          <Plane className="h-7 w-7 text-sky-600" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Create passenger account</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Register securely to manage your AeroLink journeys.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-100 animate-fade-in-up" style={{ animationDuration: '0.4s' }}>
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-6 mt-8">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold leading-6 text-slate-900">
            Email Address
          </label>
          <div className="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 transition-shadow"
              placeholder="you@example.com"
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

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-semibold leading-6 text-slate-900">
            Confirm Password
          </label>
          <div className="mt-2">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? <LoadingSpinner size="sm" label="" /> : "Create Account"}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-500 transition-colors">
          Already have an account? Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
