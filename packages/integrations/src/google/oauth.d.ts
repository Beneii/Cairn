/**
 * Google OAuth Client
 *
 * Handles authentication with Google APIs for Gmail and Calendar access.
 * Tokens are stored in .env and loaded at runtime.
 */
import { google } from "googleapis";
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
/**
 * Initialize OAuth client with credentials from environment
 */
export declare function initGoogleOAuth(): OAuth2Client | null;
/**
 * Get the OAuth client (initializes if needed)
 */
export declare function getGoogleOAuth(): OAuth2Client | null;
/**
 * Check if Google is configured and authenticated
 */
export declare function isGoogleAuthenticated(): boolean;
/**
 * Generate OAuth URL for user authorization
 */
export declare function getAuthUrl(): string | null;
/**
 * Exchange authorization code for tokens
 */
export declare function exchangeCodeForTokens(code: string): Promise<string | null>;
export {};
//# sourceMappingURL=oauth.d.ts.map