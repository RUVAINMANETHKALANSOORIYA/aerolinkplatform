// ── API base URL ──────────────────────────────────────────────────────────────
// Set VITE_API_BASE_URL in .env.local to the ECS ALB base URL.
// Example: VITE_API_BASE_URL=http://<your-alb-dns-name>
//
// Do NOT commit .env.local — it is covered by *.local in .gitignore.

function normalizeBaseUrl(value) {
	return value ? value.replace(/\/$/, "") : "";
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = normalizeBaseUrl(configuredBaseUrl || "");

// ── Cognito configuration ─────────────────────────────────────────────────────
// All values come from .env.local — never hardcoded here.
//
// VITE_AWS_REGION            AWS region, e.g. us-east-1
// VITE_COGNITO_USER_POOL_ID  Cognito User Pool ID, e.g. us-east-1_xxxxxxxxx
// VITE_COGNITO_APP_CLIENT_ID Cognito App Client ID (no secret)

export const AWS_REGION = import.meta.env.VITE_AWS_REGION?.trim() || "us-east-1";
export const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() || "";
export const COGNITO_APP_CLIENT_ID = import.meta.env.VITE_COGNITO_APP_CLIENT_ID?.trim() || "";