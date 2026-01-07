#!/usr/bin/env node
/**
 * Weather & Air Quality Polling Service
 * Fetches data from OpenWeatherMap APIs once per hour
 * Stores results in local JSON files for the dashboard to read
 *
 * APIs used:
 * - One Call API 3.0: UV index, dew point, detailed forecasts
 * - Air Pollution API: PM2.5, PM10, O3, NO2, SO2, CO, NH3
 *
 * RATE LIMITS:
 * - Max 1 call per hour per API
 * - Hard limit: 50 total API calls per day
 *
 * Run via cron: 0 * * * * /usr/bin/node /opt/homelab/homeassistant/www/dashboard/poll-air-quality.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    apiKey: 'b3704ce83731bbdfe9b9ea853133f237',
    lat: -26.1847,
    lon: 28.1298,
    location: 'Bedfordview',
    // Output files
    airQualityFile: path.join(__dirname, 'air-quality-data.json'),
    weatherExtrasFile: path.join(__dirname, 'weather-extras-data.json'),
    statsFile: path.join(__dirname, 'owm-poll-stats.json'),
    // Rate limits
    maxCallsPerDay: 50,
    minIntervalMs: 55 * 60 * 1000  // 55 minutes minimum between calls
};

/**
 * Load or initialize stats tracking
 */
function loadStats() {
    try {
        if (fs.existsSync(CONFIG.statsFile)) {
            const stats = JSON.parse(fs.readFileSync(CONFIG.statsFile, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            if (stats.date !== today) {
                return { date: today, calls: 0, lastCall: 0 };
            }
            return stats;
        }
    } catch (err) {
        console.error('Error loading stats:', err.message);
    }
    return { date: new Date().toISOString().split('T')[0], calls: 0, lastCall: 0 };
}

/**
 * Save stats
 */
function saveStats(stats) {
    fs.writeFileSync(CONFIG.statsFile, JSON.stringify(stats, null, 2));
}

/**
 * Check rate limits
 */
function checkRateLimits(stats) {
    const now = Date.now();

    if (stats.calls >= CONFIG.maxCallsPerDay) {
        console.log(`BLOCKED: Daily limit reached (${stats.calls}/${CONFIG.maxCallsPerDay} calls)`);
        return false;
    }

    if (stats.lastCall && (now - stats.lastCall) < CONFIG.minIntervalMs) {
        const waitMins = Math.ceil((CONFIG.minIntervalMs - (now - stats.lastCall)) / 60000);
        console.log(`BLOCKED: Too soon since last call. Wait ${waitMins} more minutes.`);
        return false;
    }

    return true;
}

/**
 * Fetch Air Pollution data
 */
async function fetchAirPollution() {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${CONFIG.lat}&lon=${CONFIG.lon}&appid=${CONFIG.apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            console.warn(`Air Pollution API error: ${response.status} - ${text}`);
            return null;
        }
        const data = await response.json();
        return data.list?.[0] || null;
    } catch (err) {
        console.warn('Air Pollution fetch failed:', err.message);
        return null;
    }
}

/**
 * Fetch One Call 3.0 data for UV, dew point, and extras
 */
async function fetchOneCall() {
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${CONFIG.lat}&lon=${CONFIG.lon}&appid=${CONFIG.apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`One Call API error: ${response.status} - ${text}`);
        }
        return await response.json();
    } catch (err) {
        console.error('One Call fetch failed:', err.message);
        return null;
    }
}

/**
 * Convert OpenWeatherMap AQI (1-5) to US AQI scale based on PM2.5
 */
function convertToUSAQI(components) {
    const pm25 = components.pm2_5;
    if (pm25 <= 12.0) return Math.round((50 / 12.0) * pm25);
    if (pm25 <= 35.4) return Math.round(50 + ((100 - 50) / (35.4 - 12.0)) * (pm25 - 12.0));
    if (pm25 <= 55.4) return Math.round(100 + ((150 - 100) / (55.4 - 35.4)) * (pm25 - 35.4));
    if (pm25 <= 150.4) return Math.round(150 + ((200 - 150) / (150.4 - 55.4)) * (pm25 - 55.4));
    if (pm25 <= 250.4) return Math.round(200 + ((300 - 200) / (250.4 - 150.4)) * (pm25 - 150.4));
    if (pm25 <= 350.4) return Math.round(300 + ((400 - 300) / (350.4 - 250.4)) * (pm25 - 250.4));
    return Math.round(400 + ((500 - 400) / (500.4 - 350.4)) * (pm25 - 350.4));
}

/**
 * Main execution
 */
async function main() {
    console.log(`[${new Date().toISOString()}] Weather & Air Quality Polling Service`);
    console.log(`Location: ${CONFIG.location} (${CONFIG.lat}, ${CONFIG.lon})`);

    const stats = loadStats();
    console.log(`Daily calls: ${stats.calls}/${CONFIG.maxCallsPerDay}`);

    if (!checkRateLimits(stats)) {
        process.exit(0);
    }

    let callsMade = 0;
    const results = { airQuality: null, weatherExtras: null };

    // Fetch One Call 3.0 (always try this first - it's the main subscription)
    console.log('Fetching One Call 3.0 data...');
    const oneCallData = await fetchOneCall();
    callsMade++;

    if (oneCallData) {
        const current = oneCallData.current;
        const daily = oneCallData.daily?.[0];

        results.weatherExtras = {
            timestamp: new Date().toISOString(),
            location: CONFIG.location,
            source: 'OpenWeatherMap One Call 3.0',
            current: {
                uvi: current.uvi,
                dew_point: Math.round(current.dew_point * 10) / 10,
                visibility: current.visibility,
                clouds: current.clouds,
                wind_gust: current.wind_gust || null
            },
            today: {
                uvi_max: daily?.uvi || null,
                rain_mm: daily?.rain || 0,
                pop: daily?.pop ? Math.round(daily.pop * 100) : 0,
                summary: daily?.summary || null,
                moon_phase: daily?.moon_phase || null
            },
            alerts: oneCallData.alerts || [],
            stats: {
                callsToday: stats.calls + callsMade,
                maxCallsPerDay: CONFIG.maxCallsPerDay
            }
        };

        fs.writeFileSync(CONFIG.weatherExtrasFile, JSON.stringify(results.weatherExtras, null, 2));
        console.log(`SUCCESS: Weather extras saved - UV: ${current.uvi}, Dew: ${current.dew_point}°C`);
    }

    // Fetch Air Pollution
    console.log('Fetching Air Pollution data...');
    const pollutionData = await fetchAirPollution();
    callsMade++;

    if (pollutionData) {
        const components = pollutionData.components;
        const usAqi = convertToUSAQI(components);

        results.airQuality = {
            timestamp: new Date().toISOString(),
            location: CONFIG.location,
            coordinates: { lat: CONFIG.lat, lon: CONFIG.lon },
            source: 'OpenWeatherMap',
            aqi: {
                us: usAqi,
                owm: pollutionData.main.aqi
            },
            pollutants: {
                pm2_5: Math.round(components.pm2_5 * 10) / 10,
                pm10: Math.round(components.pm10 * 10) / 10,
                o3: Math.round(components.o3 * 10) / 10,
                no2: Math.round(components.no2 * 10) / 10,
                so2: Math.round(components.so2 * 10) / 10,
                co: Math.round(components.co * 10) / 10,
                nh3: Math.round(components.nh3 * 10) / 10
            },
            stats: {
                callsToday: stats.calls + callsMade,
                maxCallsPerDay: CONFIG.maxCallsPerDay,
                nextUpdateAfter: new Date(Date.now() + CONFIG.minIntervalMs).toISOString()
            }
        };

        fs.writeFileSync(CONFIG.airQualityFile, JSON.stringify(results.airQuality, null, 2));
        console.log(`SUCCESS: Air quality saved - AQI: ${usAqi}, PM2.5: ${components.pm2_5}`);
    } else {
        // Air Pollution API might not be subscribed yet - write status file
        const statusData = {
            timestamp: new Date().toISOString(),
            location: CONFIG.location,
            source: 'OpenWeatherMap',
            error: 'Air Pollution API not available - please subscribe at openweathermap.org',
            stats: {
                callsToday: stats.calls + callsMade,
                maxCallsPerDay: CONFIG.maxCallsPerDay
            }
        };
        fs.writeFileSync(CONFIG.airQualityFile, JSON.stringify(statusData, null, 2));
        console.log('WARNING: Air Pollution API not available');
    }

    // Update stats
    stats.calls += callsMade;
    stats.lastCall = Date.now();
    saveStats(stats);

    console.log(`\nTotal calls made: ${callsMade}`);
    console.log(`Daily total: ${stats.calls}/${CONFIG.maxCallsPerDay}`);
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
