/**
 * Google OAuth Client
 * 
 * Handles authentication with Google APIs for Gmail and Calendar access.
 * Tokens are stored in .env and loaded at runtime.
 */

import { google } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

let oauthClient: OAuth2Client | null = null;

/**
 * Initialize OAuth client with credentials from environment
 */
export function initGoogleOAuth(): OAuth2Client | null {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
        console.log("[google] OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)");
        return null;
    }

    const redirectUri = `${process.env.GATEWAY_URL || "http://localhost:3100"}/oauth/callback`;
    oauthClient = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
    );

    if (refreshToken) {
        oauthClient.setCredentials({
            refresh_token: refreshToken,
        });
        console.log("[google] OAuth client initialized with refresh token");
    } else {
        console.log("[google] OAuth client initialized (no refresh token yet)");
    }

    return oauthClient;
}

/**
 * Get the OAuth client (initializes if needed)
 */
export function getGoogleOAuth(): OAuth2Client | null {
    if (!oauthClient) {
        return initGoogleOAuth();
    }
    return oauthClient;
}

/**
 * Check if Google is configured and authenticated
 */
export function isGoogleAuthenticated(): boolean {
    const client = getGoogleOAuth();
    return !!(client && process.env.GOOGLE_REFRESH_TOKEN);
}

/**
 * Generate OAuth URL for user authorization
 */
export function getAuthUrl(): string | null {
    const client = getGoogleOAuth();
    if (!client) return null;

    return client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
        ],
        prompt: "consent", // Force consent to get refresh token
    });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<string | null> {
    const client = getGoogleOAuth();
    if (!client) return null;

    try {
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        return tokens.refresh_token || null;
    } catch (err) {
        console.error("[google] Token exchange failed:", err);
        return null;
    }
}
