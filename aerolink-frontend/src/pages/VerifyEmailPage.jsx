import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Plane, AlertCircle, CheckCircle2 } from "lucide-react";
import { cognitoConfirmPassengerSignUp, cognitoResendPassengerCode } from "../auth.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!email || !code) {
      setError("Please enter both email and verification code.");
      return;
    }

    setLoading(true);
    setError("");
    setResendMsg("");

    try {
      await cognitoConfirmPassengerSignUp(email, code);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Verification failed. Please check your code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please enter your email address to resend the code.");
      return;
    }
    
    setResending(true);
    setError("");
    setResendMsg("");
    
    try {
      await cognitoResendPassengerCode(email);
      setResendMsg("A new verification code has been sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend confirmation code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout heroTitle="Begin your journey" heroSubtitle="Create your passenger account to book flights and track your travel updates.">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 bg-sky-50 rounded-2xl flex items-center justify-center mb-6 lg:hidden ring-1 ring-inset ring-sky-100">
          <Plane className="h-7 w-7 text-sky-600" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Verify your email</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Enter the verification code sent to your email address to activate your passenger account.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-100 animate-fade-in-up mt-8" style={{ animationDuration: '0.4s' }}>
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {resendMsg && !success && (
        <div className="flex items-start gap-3 rounded-lg bg-sky-50 p-4 text-sm font-medium text-sky-800 border border-sky-100 animate-fade-in-up mt-8" style={{ animationDuration: '0.4s' }}>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
          <p>{resendMsg}</p>
        </div>
      )}

      {success ? (
        <div className="space-y-6 mt-8 animate-fade-in-up" style={{ animationDuration: '0.4s' }}>
          <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-emerald-900 text-center">Verification Complete</h3>
            <p className="text-sm text-emerald-700 text-center mt-2">
              Your passenger account has been verified successfully. You can now sign in.
            </p>
          </div>
          
          <button
            onClick={() => navigate("/login")}
            className="flex w-full justify-center items-center gap-2 rounded-lg bg-sky-600 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-sky-500 transition-all active:scale-[0.98]"
          >
            Continue to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-6 mt-8">
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
            <label htmlFor="code" className="block text-sm font-semibold leading-6 text-slate-900">
              Verification Code
            </label>
            <div className="mt-2">
              <input
                id="code"
                name="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6 tracking-widest transition-shadow font-mono"
                placeholder="123456"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center items-center gap-2 rounded-lg bg-sky-600 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loading ? <LoadingSpinner size="sm" label="" /> : "Verify Account"}
          </button>

          <div className="flex flex-col gap-4 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              {resending ? "Sending code..." : "Resend Code"}
            </button>

            <Link to="/login" className="text-sm font-semibold text-sky-600 hover:text-sky-500 transition-colors">
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
