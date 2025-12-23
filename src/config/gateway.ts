// Gateway configuration - centralized config for all gateway API calls
// To change the gateway URL, set VITE_GATEWAY_BASE_URL in your environment

export const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_BASE_URL || 'https://gateway.walinkme.com';
export const ADMIN_TOKEN = import.meta.env.VITE_GATEWAY_ADMIN_TOKEN || '@dmin142242';

// Build version for cache busting
export const BUILD_VERSION = '1.0.1';
