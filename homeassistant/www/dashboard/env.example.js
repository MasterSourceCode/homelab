/**
 * Environment Configuration Template
 * Copy this file to env.local.js and update with your actual values
 * env.local.js is gitignored and will not be committed
 */
window.DASHBOARD_ENV = {
    // Server IP - Replace with your Home Assistant server IP
    SERVER_IP: '192.168.x.x',

    // Home Assistant
    HA_PORT: 8123,

    // Frigate
    FRIGATE_CORS_PORT: 5003,  // CORS proxy port
    FRIGATE_UI_PORT: 8971,    // Direct UI port (HTTPS)

    // PC Metrics (optional - set enabled to false if not using)
    PC_METRICS_PORT: 8765,
    PC_METRICS_ENABLED: false,

    // External URLs (for sharing/remote access)
    EXTERNAL_HA_URL: 'https://your-nabu-casa-url.ui.nabu.casa',
    EXTERNAL_FRIGATE_URL: 'https://your-frigate-external-url',

    // Google Calendar API (REQUIRED)
    // Get your API key from https://console.cloud.google.com/apis/credentials
    GOOGLE_CALENDAR_API_KEY: 'YOUR_GOOGLE_API_KEY',
    GOOGLE_CALENDAR_ID: 'your-calendar-email@gmail.com',

    // Computed URLs (for convenience) - DO NOT MODIFY
    get HA_URL() { return `http://${this.SERVER_IP}:${this.HA_PORT}`; },
    get FRIGATE_API_URL() { return `http://${this.SERVER_IP}:${this.FRIGATE_CORS_PORT}/api`; },
    get FRIGATE_URL() { return `http://${this.SERVER_IP}:${this.FRIGATE_CORS_PORT}`; },
    get FRIGATE_UI_URL() { return `http://${this.SERVER_IP}:${this.FRIGATE_UI_PORT}`; },
    get PC_METRICS_URL() { return `http://${this.SERVER_IP}:${this.PC_METRICS_PORT}/api/metrics`; }
};
