const defaultApiBaseUrl = "https://koezoo3dx4.execute-api.us-east-1.amazonaws.com";

function normalizeBaseUrl(value) {
	return value.replace(/\/$/, "");
}

function normalizeStage(value) {
	return value.replace(/^\/+|\/+$/g, "");
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredStage = import.meta.env.VITE_API_STAGE?.trim();

export const API_BASE_URL = normalizeBaseUrl(
	configuredBaseUrl || (configuredStage ? `${defaultApiBaseUrl}/${normalizeStage(configuredStage)}` : defaultApiBaseUrl)
);