// Gateway configuration - centralized config for all gateway API calls
// To change the gateway URL, set VITE_GATEWAY_BASE_URL in your environment

export const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_BASE_URL || 'https://gateway.walinkme.com';
export const ADMIN_TOKEN = import.meta.env.VITE_GATEWAY_ADMIN_TOKEN || '@dmin142242';

// Credentials required to sign into this dashboard (separate from the API admin token above).
// Set VITE_GATEWAY_ADMIN_EMAIL / VITE_GATEWAY_ADMIN_PASSWORD in your environment to override.
export const ADMIN_EMAIL = import.meta.env.VITE_GATEWAY_ADMIN_EMAIL || 'admin@walinkme.com';
export const ADMIN_LOGIN_PASSWORD = import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD || '@dmin142242';


// Build version for cache busting
export const BUILD_VERSION = '1.0.1';
