/**
 * auth.js — Cognito authentication helpers for AeroLink frontend.
 *
 * Uses amazon-cognito-identity-js (USER_PASSWORD_AUTH flow).
 * No hardcoded credentials. Pool config comes from config.js which reads
 * VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_APP_CLIENT_ID from .env.local.
 *
 * Exports
 * -------
 *   cognitoLogin(username, password)  → Promise<{ accessToken, username, groups }>
 *   cognitoLogout()                   → void  (clears localStorage)
 *   getStoredAccessToken()            → string | null
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

import { COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID } from "./config.js";

// ── User pool ─────────────────────────────────────────────────────────────────

function getUserPool() {
  if (!COGNITO_USER_POOL_ID || !COGNITO_APP_CLIENT_ID) {
    throw new Error(
      "Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and " +
        "VITE_COGNITO_APP_CLIENT_ID in .env.local."
    );
  }
  return new CognitoUserPool({
    UserPoolId: COGNITO_USER_POOL_ID,
    ClientId: COGNITO_APP_CLIENT_ID,
  });
}

// ── Parse Cognito groups from the access token payload ────────────────────────

function parseGroups(accessToken) {
  try {
    const payload = accessToken.decodePayload();
    const groups = payload["cognito:groups"];
    if (Array.isArray(groups) && groups.length > 0) {
      return groups;
    }
  } catch {
    // ignore decode errors
  }
  return [];
}

// ── Derive a display role from Cognito groups ─────────────────────────────────
// Actual permission enforcement lives in the ECS API Gateway.
// This is for UI display only.

function groupsToDisplayRole(groups) {
  if (groups.includes("Staff")) return "staff";
  if (groups.includes("Passenger")) return "passenger";
  return groups[0]?.toLowerCase() || "user";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Authenticate against Cognito using USER_PASSWORD_AUTH.
 * Returns the Cognito access token string plus display metadata.
 *
 * @param {string} username  Cognito username (not email alias unless configured)
 * @param {string} password  User password — never stored or logged
 * @returns {Promise<{ accessToken: string, username: string, role: string }>}
 */
export function cognitoLogin(username, password) {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess(session) {
        const accessToken = session.getAccessToken();
        const jwtString = accessToken.getJwtToken();
        const groups = parseGroups(accessToken);
        const role = groupsToDisplayRole(groups);

        // Store only the access token and display metadata.
        // No refresh token is written to localStorage.
        localStorage.setItem("token", jwtString);
        localStorage.setItem("username", username);
        localStorage.setItem("role", role);

        resolve({ accessToken: jwtString, username, role });
      },

      onFailure(err) {
        // Map Cognito error codes to friendly messages.
        const code = err.code || "";
        let message = "Login failed. Please check your username and password.";
        if (code === "NotAuthorizedException") {
          message = "Incorrect username or password.";
        } else if (code === "UserNotFoundException") {
          message = "User not found. Check the username and try again.";
        } else if (code === "UserNotConfirmedException") {
          message = "Account not confirmed. Check your email for a verification link.";
        } else if (code === "PasswordResetRequiredException") {
          message = "A password reset is required before you can log in.";
        } else if (err.message) {
          message = err.message;
        }
        reject(new Error(message));
      },

      // NEW_PASSWORD_REQUIRED challenge — surface a clear error rather than
      // silently hanging, since the frontend has no password-reset flow yet.
      newPasswordRequired(_userAttributes, _requiredAttributes) {
        reject(
          new Error(
            "Your account requires a new password. Please reset your password " +
              "through the AWS Cognito console or contact your administrator."
          )
        );
      },
    });
  });
}

/**
 * Clear all locally stored auth state.
 * The Cognito session cookie (if any) is not invalidated server-side —
 * access tokens remain valid until expiry, which is acceptable for this
 * client-only logout.
 */
export function cognitoLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
}

/**
 * Returns the stored Cognito access token, or null if not signed in.
 */
export function getStoredAccessToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}
