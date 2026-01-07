/**
 * Weather Command Center
 * Comprehensive weather dashboard with Open-Meteo integration
 */

// Bedfordview coordinates
const LOCATION = {
    lat: -26.1847,
    lon: 28.1298,
    name: 'Bedfordview',
    timezone: 'Africa/Johannesburg'
};

// Air quality data is fetched from local cache (air-quality-data.json)
// Updated hourly by poll-air-quality.js service using OpenWeatherMap API

// WMO Weather Code Mapping
const WMO_CODES = {
    0: { icon: 'sun', text: 'Clear sky', color: 'amber', class: 'sunny' },
    1: { icon: 'sun-cloud', text: 'Mainly clear', color: 'amber', class: 'sunny' },
    2: { icon: 'cloud-sun', text: 'Partly cloudy', color: 'slate', class: 'cloudy' },
    3: { icon: 'cloud', text: 'Overcast', color: 'slate', class: 'cloudy' },
    45: { icon: 'fog', text: 'Fog', color: 'slate', class: 'cloudy' },
    48: { icon: 'fog', text: 'Depositing rime fog', color: 'slate', class: 'cloudy' },
    51: { icon: 'drizzle', text: 'Light drizzle', color: 'blue', class: 'rainy' },
    53: { icon: 'drizzle', text: 'Moderate drizzle', color: 'blue', class: 'rainy' },
    55: { icon: 'drizzle', text: 'Dense drizzle', color: 'blue', class: 'rainy' },
    56: { icon: 'drizzle', text: 'Freezing drizzle', color: 'cyan', class: 'rainy' },
    57: { icon: 'drizzle', text: 'Dense freezing drizzle', color: 'cyan', class: 'rainy' },
    61: { icon: 'rain', text: 'Slight rain', color: 'blue', class: 'rainy' },
    63: { icon: 'rain', text: 'Moderate rain', color: 'blue', class: 'rainy' },
    65: { icon: 'rain-heavy', text: 'Heavy rain', color: 'blue', class: 'rainy' },
    66: { icon: 'rain', text: 'Freezing rain', color: 'cyan', class: 'rainy' },
    67: { icon: 'rain-heavy', text: 'Heavy freezing rain', color: 'cyan', class: 'rainy' },
    71: { icon: 'snow', text: 'Slight snow', color: 'cyan', class: 'snowy' },
    73: { icon: 'snow', text: 'Moderate snow', color: 'cyan', class: 'snowy' },
    75: { icon: 'snow', text: 'Heavy snow', color: 'cyan', class: 'snowy' },
    77: { icon: 'snow', text: 'Snow grains', color: 'cyan', class: 'snowy' },
    80: { icon: 'showers', text: 'Slight showers', color: 'blue', class: 'rainy' },
    81: { icon: 'showers', text: 'Moderate showers', color: 'blue', class: 'rainy' },
    82: { icon: 'showers', text: 'Violent showers', color: 'blue', class: 'rainy' },
    85: { icon: 'snow', text: 'Slight snow showers', color: 'cyan', class: 'snowy' },
    86: { icon: 'snow', text: 'Heavy snow showers', color: 'cyan', class: 'snowy' },
    95: { icon: 'thunderstorm', text: 'Thunderstorm', color: 'purple', class: 'stormy' },
    96: { icon: 'thunderstorm-hail', text: 'Thunderstorm with hail', color: 'purple', class: 'stormy' },
    99: { icon: 'thunderstorm-hail', text: 'Severe thunderstorm', color: 'purple', class: 'stormy' }
};

// AQI Levels
const AQI_LEVELS = {
    good: { max: 50, color: '#22c55e', label: 'Good', advice: 'Air quality is satisfactory. Enjoy outdoor activities!' },
    moderate: { max: 100, color: '#eab308', label: 'Moderate', advice: 'Acceptable quality. Unusually sensitive people should limit prolonged outdoor exertion.' },
    unhealthy_sensitive: { max: 150, color: '#f97316', label: 'Unhealthy for Sensitive Groups', advice: 'Sensitive groups should reduce prolonged outdoor exertion.' },
    unhealthy: { max: 200, color: '#ef4444', label: 'Unhealthy', advice: 'Everyone may begin to experience health effects. Limit outdoor activity.' },
    very_unhealthy: { max: 300, color: '#a855f7', label: 'Very Unhealthy', advice: 'Health alert: everyone may experience serious health effects.' },
    hazardous: { max: 500, color: '#7f1d1d', label: 'Hazardous', advice: 'Emergency conditions. Everyone should avoid all outdoor activity.' }
};

// Weather icons SVG templates
const WEATHER_ICONS = {
    sun: `<svg class="w-full h-full weather-icon-sun" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5"/>
        <path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`,
    'sun-cloud': `<svg class="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="8" cy="8" r="3" fill="#fbbf24"/>
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#94a3b8"/>
    </svg>`,
    'cloud-sun': `<svg class="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="17" cy="7" r="3" fill="#fbbf24"/>
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#94a3b8"/>
    </svg>`,
    cloud: `<svg class="w-full h-full weather-icon-cloud" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
    </svg>`,
    fog: `<svg class="w-full h-full weather-icon-cloud" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-width="2" d="M4 8h16M4 12h16M4 16h12"/>
    </svg>`,
    drizzle: `<svg class="w-full h-full weather-icon-rain" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#64748b"/>
        <circle cx="8" cy="19" r="1" fill="#3b82f6"/><circle cx="12" cy="21" r="1" fill="#3b82f6"/><circle cx="16" cy="19" r="1" fill="#3b82f6"/>
    </svg>`,
    rain: `<svg class="w-full h-full weather-icon-rain" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#64748b"/>
        <path stroke="#3b82f6" stroke-width="2" stroke-linecap="round" d="M8 17v4M12 17v4M16 17v4"/>
    </svg>`,
    'rain-heavy': `<svg class="w-full h-full weather-icon-rain" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#475569"/>
        <path stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" d="M7 17v5M11 17v5M15 17v5M19 17v3"/>
    </svg>`,
    showers: `<svg class="w-full h-full weather-icon-rain" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#64748b"/>
        <path stroke="#3b82f6" stroke-width="2" stroke-linecap="round" d="M9 17v3M13 18v4M17 17v2"/>
    </svg>`,
    snow: `<svg class="w-full h-full weather-icon-snow" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#94a3b8"/>
        <circle cx="8" cy="18" r="1.5" fill="#e0f2fe"/><circle cx="12" cy="20" r="1.5" fill="#e0f2fe"/><circle cx="16" cy="18" r="1.5" fill="#e0f2fe"/>
    </svg>`,
    thunderstorm: `<svg class="w-full h-full weather-icon-storm" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#475569"/>
        <path d="M13 12l-2 4h3l-2 5 5-6h-3l2-3h-3z" fill="#fbbf24"/>
    </svg>`,
    'thunderstorm-hail': `<svg class="w-full h-full weather-icon-storm" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#374151"/>
        <path d="M13 10l-2 4h3l-2 5 5-6h-3l2-3h-3z" fill="#fbbf24"/>
        <circle cx="7" cy="20" r="2" fill="#e0f2fe"/><circle cx="17" cy="20" r="2" fill="#e0f2fe"/>
    </svg>`
};

// Cache for weather data
let weatherCache = {
    data: null,
    airQuality: null,
    historical: null,
    lastFetch: 0
};

// Radar state
let radarMap = null;
let radarLayers = [];
let radarAnimationIndex = 0;
let radarAnimationPlaying = false;
let radarAnimationInterval = null;

// Initialization state
let isInitialized = false;
let refreshInterval = null;

/**
 * Initialize Weather Dashboard
 */
export function initWeather() {
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('[Weather] Already initialized, refreshing data...');
        fetchAllWeatherData();
        return;
    }

    console.log('[Weather] Initializing Weather Command Center...');

    // Wait for the view to be actually loaded in the DOM
    waitForElement('currentTemp', 10).then(() => {
        console.log('[Weather] View elements ready, fetching data...');
        isInitialized = true;

        // Fetch initial data
        fetchAllWeatherData();

        // Set up auto-refresh (every 5 minutes)
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(fetchAllWeatherData, 5 * 60 * 1000);

        // Initialize radar map
        setTimeout(initRadarMap, 500);

        // Set up radar play button
        const radarPlayBtn = document.getElementById('radarPlayBtn');
        if (radarPlayBtn) {
            radarPlayBtn.addEventListener('click', toggleRadarAnimation);
        }
    }).catch(err => {
        console.error('[Weather] Failed to find view elements:', err);
    });
}

/**
 * Wait for an element to exist in the DOM
 */
function waitForElement(id, maxAttempts = 10, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            const el = document.getElementById(id);
            if (el) {
                resolve(el);
            } else if (attempts >= maxAttempts) {
                reject(new Error(`Element ${id} not found after ${maxAttempts} attempts`));
            } else {
                attempts++;
                setTimeout(check, interval);
            }
        };
        check();
    });
}

/**
 * Fetch all weather data from multiple sources
 */
async function fetchAllWeatherData() {
    console.log('[Weather] Fetching weather data...');

    try {
        // Fetch all data in parallel
        const [weatherResult, airQualityResult, weatherExtrasResult, historicalResult] = await Promise.allSettled([
            fetchWeatherData(),
            fetchAirQuality(),
            fetchWeatherExtras(),
            fetchHistoricalData()
        ]);

        // Process main weather data (Open-Meteo)
        if (weatherResult.status === 'fulfilled') {
            weatherCache.data = weatherResult.value;
            console.log('[Weather] Weather data received');

            updateCurrentConditions(weatherResult.value);
            updateHourlyForecast(weatherResult.value);
            updateWeeklyForecast(weatherResult.value);
            updateAtmosphericMetrics(weatherResult.value);
            updateSunTimes(weatherResult.value);
            updateWeatherBackground(weatherResult.value);
            updateHeaderBadge(weatherResult.value);
        } else {
            console.error('[Weather] Weather fetch failed:', weatherResult.reason);
        }

        // Process weather extras (One Call 3.0 - UV, dew point, alerts)
        if (weatherExtrasResult.status === 'fulfilled' && weatherExtrasResult.value) {
            weatherCache.extras = weatherExtrasResult.value;
            console.log('[Weather] Weather extras loaded:', weatherExtrasResult.value);
            updateWeatherExtras(weatherExtrasResult.value);
            updateGovernmentAlerts(weatherExtrasResult.value);
        }

        // Process air quality data
        let aqData = null;
        if (airQualityResult.status === 'fulfilled' && airQualityResult.value?.current) {
            aqData = airQualityResult.value;
            console.log('[Weather] Air quality data loaded');
        } else {
            console.warn('[Weather] Air quality data unavailable');
        }
        weatherCache.airQuality = aqData;
        updateAirQuality(aqData);

        // Process historical data
        if (historicalResult.status === 'fulfilled') {
            weatherCache.historical = historicalResult.value;
            if (weatherCache.data) {
                updateHistoricalComparison(weatherCache.data, historicalResult.value);
            }
        }

        weatherCache.lastFetch = Date.now();

        // Update last update time
        const lastUpdateEl = document.getElementById('weatherLastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `Updated ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
        }

        console.log('[Weather] Data update complete');
    } catch (error) {
        console.error('[Weather] Error fetching weather data:', error);
    }
}

/**
 * Fetch weather extras from local cache (One Call 3.0 data)
 * Includes: UV index, dew point, government alerts, weather summary
 */
async function fetchWeatherExtras() {
    const cacheUrl = './weather-extras-data.json?v=' + Date.now();

    try {
        const response = await fetch(cacheUrl);
        if (!response.ok) {
            console.warn('[Weather] Weather extras cache not found');
            return null;
        }
        return await response.json();
    } catch (err) {
        console.warn('[Weather] Error loading weather extras:', err);
        return null;
    }
}

/**
 * Update UI with weather extras (dew point, UV max, rain forecast)
 */
function updateWeatherExtras(extras) {
    if (!extras) return;

    // Update dew point
    if (extras.current?.dew_point !== undefined) {
        setText('dewPointValue', `${Math.round(extras.current.dew_point)}°C`);
    }

    // Update UV index with max from today (more useful than current at night)
    const uvValue = extras.current?.uvi || 0;
    const uvMax = extras.today?.uvi_max || uvValue;
    const uvEl = document.getElementById('uvValue');
    if (uvEl) {
        // Show current UV, or max if nighttime
        const displayUV = uvValue > 0 ? uvValue : uvMax;
        uvEl.textContent = displayUV.toFixed(1);
        // Add "max" indicator if showing max value at night
        if (uvValue === 0 && uvMax > 0) {
            uvEl.textContent = `${uvMax.toFixed(1)}`;
            const labelEl = uvEl.closest('.weather-card-metric')?.querySelector('.metric-label');
            if (labelEl) labelEl.textContent = 'UV Max Today';
        }
    }

    // Update rain probability
    if (extras.today?.pop !== undefined) {
        const rainProbEl = document.getElementById('rainProbValue');
        if (rainProbEl) {
            rainProbEl.textContent = `${extras.today.pop}%`;
        }
    }

    // Update weather summary
    if (extras.today?.summary) {
        const summaryEl = document.getElementById('weatherSummary');
        if (summaryEl) {
            summaryEl.textContent = extras.today.summary;
        }
    }
}

/**
 * Update government weather alerts from One Call 3.0
 */
function updateGovernmentAlerts(extras) {
    const alertsBar = document.getElementById('weatherAlertsBar');
    const alertText = document.getElementById('alertText');
    if (!alertsBar) return;

    const alerts = extras?.alerts || [];

    if (alerts.length > 0) {
        // Show the most severe/recent alert
        const alert = alerts[0];
        alertsBar.classList.remove('hidden');
        alertsBar.classList.add('severe');

        if (alertText) {
            const eventName = alert.event || 'Weather Alert';
            const sender = alert.sender_name || '';
            alertText.innerHTML = `<strong>${eventName}</strong> - ${alert.description?.split('\n')[0] || 'Check local weather service'} <span class="text-white/40 ml-2">${sender}</span>`;
        }

        // Show storm indicator if thunderstorm
        const stormIndicator = document.getElementById('stormPotential');
        if (stormIndicator && alert.event?.toLowerCase().includes('thunder')) {
            stormIndicator.classList.remove('hidden');
            const stormChance = document.getElementById('stormChance');
            if (stormChance) stormChance.textContent = 'ACTIVE';
        }

        console.log('[Weather] Government alert active:', alert.event);
    } else {
        alertsBar.classList.add('hidden');
    }
}

/**
 * Fetch current and forecast weather data
 */
async function fetchWeatherData() {
    const params = new URLSearchParams({
        latitude: LOCATION.lat,
        longitude: LOCATION.lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index,is_day',
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max',
        timezone: LOCATION.timezone,
        forecast_days: 7
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error('Weather API error');
    return response.json();
}

/**
 * Fetch air quality data from local cache file
 * Data is updated hourly by poll-air-quality.js service
 * This ensures we never exceed API rate limits from the dashboard
 */
async function fetchAirQuality() {
    const cacheUrl = './air-quality-data.json?v=' + Date.now();

    try {
        const response = await fetch(cacheUrl);

        if (!response.ok) {
            console.warn('[Weather] Air quality cache not found. Run poll-air-quality.js to initialize.');
            return null;
        }

        const data = await response.json();

        // Check for error state
        if (data.error) {
            console.warn('[Weather] Air quality cache has error:', data.error);
            return null;
        }

        // Check data freshness (warn if older than 2 hours)
        const dataAge = Date.now() - new Date(data.timestamp).getTime();
        const ageHours = dataAge / (1000 * 60 * 60);
        if (ageHours > 2) {
            console.warn(`[Weather] Air quality data is ${ageHours.toFixed(1)} hours old`);
        }

        console.log('[Weather] Air quality data loaded:', {
            source: data.source,
            aqi: data.aqi?.us,
            pm25: data.pollutants?.pm2_5,
            age: `${Math.round(dataAge / 60000)} mins`
        });

        // Map to our format
        return {
            current: {
                aqi: data.aqi?.us,
                us_aqi: data.aqi?.us,
                pm2_5: data.pollutants?.pm2_5,
                pm10: data.pollutants?.pm10,
                ozone: data.pollutants?.o3,
                nitrogen_dioxide: data.pollutants?.no2,
                sulphur_dioxide: data.pollutants?.so2,
                carbon_monoxide: data.pollutants?.co,
                timestamp: data.timestamp
            },
            source: data.source || 'OpenWeatherMap',
            location: data.location,
            stats: data.stats
        };

    } catch (err) {
        console.error('[Weather] Error loading air quality cache:', err);
        return null;
    }
}

/**
 * Estimate AQI based on weather conditions
 * Uses meteorological factors: wind, humidity, weather type, temperature
 */
function estimateAQIFromWeather(weatherData) {
    if (!weatherData?.current) return null;

    const current = weatherData.current;
    const windSpeed = current.wind_speed_10m || 0;
    const humidity = current.relative_humidity_2m || 50;
    const weatherCode = current.weather_code || 0;
    const cloudCover = current.cloud_cover || 0;
    const uvIndex = current.uv_index || 0;

    // Base AQI estimation (Bedfordview typically has moderate air quality)
    let estimatedAQI = 45; // Start with "Good" baseline

    // Wind factor: Higher wind = better dispersion = lower AQI
    if (windSpeed > 20) estimatedAQI -= 15;
    else if (windSpeed > 10) estimatedAQI -= 8;
    else if (windSpeed < 5) estimatedAQI += 15; // Stagnant air

    // Humidity factor: Very high humidity can trap pollutants
    if (humidity > 85) estimatedAQI += 12;
    else if (humidity > 70) estimatedAQI += 5;
    else if (humidity < 30) estimatedAQI += 8; // Dust more likely

    // Weather type factor
    if (weatherCode >= 61 && weatherCode <= 67) estimatedAQI -= 20; // Rain cleans air
    else if (weatherCode >= 80 && weatherCode <= 82) estimatedAQI -= 15; // Showers
    else if (weatherCode >= 95) estimatedAQI -= 10; // Thunderstorms clear air
    else if (weatherCode >= 45 && weatherCode <= 48) estimatedAQI += 20; // Fog traps pollutants

    // Time of day (peak traffic hours have worse air quality)
    const hour = new Date().getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
        estimatedAQI += 15; // Rush hour effect
    }

    // UV factor: High UV can increase ozone
    if (uvIndex > 8) estimatedAQI += 8;

    // Clamp to valid range
    estimatedAQI = Math.max(15, Math.min(200, estimatedAQI));

    // Estimate individual pollutants based on AQI
    const pm25 = Math.round(estimatedAQI * 0.35 + Math.random() * 5);
    const pm10 = Math.round(pm25 * 1.8 + Math.random() * 10);
    const ozone = Math.round(20 + (uvIndex * 8) + Math.random() * 10);
    const no2 = Math.round(10 + (estimatedAQI * 0.2) + Math.random() * 5);

    return {
        aqi: Math.round(estimatedAQI),
        pm2_5: pm25,
        pm10: pm10,
        ozone: ozone,
        nitrogen_dioxide: no2,
        isEstimated: true
    };
}

/**
 * Fetch historical data for comparison
 */
async function fetchHistoricalData() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const params = new URLSearchParams({
        latitude: LOCATION.lat,
        longitude: LOCATION.lon,
        start_date: dateStr,
        end_date: dateStr,
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
        timezone: LOCATION.timezone
    });

    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
    if (!response.ok) throw new Error('Historical API error');
    return response.json();
}

/**
 * Update current conditions display
 */
function updateCurrentConditions(data) {
    if (!data?.current) {
        console.warn('[Weather] No current conditions data');
        return;
    }

    const current = data.current;
    const daily = data.daily;

    console.log('[Weather] Current conditions:', {
        temp: current.temperature_2m,
        feels: current.apparent_temperature,
        code: current.weather_code,
        humidity: current.relative_humidity_2m
    });

    // Temperature
    const temp = current.temperature_2m;
    if (temp !== undefined && temp !== null) {
        setText('currentTemp', Math.round(temp));
    }

    const feelsLike = current.apparent_temperature;
    if (feelsLike !== undefined && feelsLike !== null) {
        setText('feelsLike', `${Math.round(feelsLike)}°`);
    }

    // High/Low
    if (daily?.temperature_2m_max?.[0] !== undefined) {
        setText('todayHigh', `${Math.round(daily.temperature_2m_max[0])}°`);
    }
    if (daily?.temperature_2m_min?.[0] !== undefined) {
        setText('todayLow', `${Math.round(daily.temperature_2m_min[0])}°`);
    }

    // Weather condition
    const weatherCode = current.weather_code;
    const weatherInfo = WMO_CODES[weatherCode] || { text: 'Unknown', icon: 'cloud' };
    console.log('[Weather] Weather code:', weatherCode, '-> Info:', weatherInfo);
    setText('currentCondition', weatherInfo.text);

    // Weather icon
    const iconEl = document.getElementById('currentWeatherIcon');
    if (iconEl && WEATHER_ICONS[weatherInfo.icon]) {
        iconEl.innerHTML = WEATHER_ICONS[weatherInfo.icon];
    }
}

/**
 * Update air quality display with IQAir data
 */
function updateAirQuality(data) {
    // Handle case where AQ data is not available
    if (!data || !data.current) {
        console.warn('[Weather] Air quality data not available');
        setText('aqiValue', 'N/A');

        const aqiLabel = document.getElementById('aqiLabel');
        if (aqiLabel) {
            aqiLabel.textContent = 'Unavailable';
            aqiLabel.style.color = '#94a3b8';
        }

        setText('pm25Value', '--');
        setText('pm10Value', '--');
        setText('o3Value', '--');
        setText('no2Value', '--');

        const adviceEl = document.getElementById('aqiAdvice');
        if (adviceEl) {
            adviceEl.innerHTML = `
                <svg class="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-white/50 text-xs">Air quality data unavailable</span>
            `;
        }
        return;
    }

    const current = data.current;
    const aqi = current.aqi || current.us_aqi || 0;
    const source = data.source || 'Unknown';
    const city = data.city || '';

    console.log('[Weather] AQI value:', aqi, 'Source:', source, 'City:', city);

    // AQI Value
    setText('aqiValue', Math.round(aqi));

    // AQI Ring (circumference = 2 * π * 42 ≈ 264)
    const aqiRing = document.getElementById('aqiRing');
    if (aqiRing) {
        const percentage = Math.min(aqi / 300, 1);
        const circumference = 264;
        const dashOffset = circumference - (circumference * percentage);
        aqiRing.style.strokeDashoffset = dashOffset;
    }

    // AQI Label with color
    const advice = getAqiAdvice(aqi);
    const aqiLabel = document.getElementById('aqiLabel');
    if (aqiLabel) {
        aqiLabel.textContent = advice.label;
        aqiLabel.style.color = advice.color;
    }

    // Status dot
    const statusDot = document.getElementById('aqiStatus');
    if (statusDot) {
        statusDot.className = 'weather-status-dot';
        if (aqi <= 50) statusDot.classList.add('good');
        else if (aqi <= 100) statusDot.classList.add('moderate');
        else statusDot.classList.add('unhealthy');
    }

    // Pollutants - show actual values or "--" if not available
    setText('pm25Value', current.pm2_5 ? Math.round(current.pm2_5) : '--');
    setText('pm10Value', current.pm10 ? Math.round(current.pm10) : '--');
    setText('o3Value', current.ozone ? Math.round(current.ozone) : '--');
    setText('no2Value', current.nitrogen_dioxide ? Math.round(current.nitrogen_dioxide) : '--');

    // Health advice bar with source attribution
    const adviceEl = document.getElementById('aqiAdvice');
    if (adviceEl) {
        const sourceText = source === 'IQAir' ? `<span class="text-white/40 ml-1">via IQAir</span>` : '';
        adviceEl.innerHTML = `
            <svg class="w-4 h-4 flex-shrink-0" style="color: ${advice.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-white/70 text-xs">${advice.advice}${sourceText}</span>
        `;
    }
}

/**
 * Get AQI level advice
 */
function getAqiAdvice(aqi) {
    for (const [key, level] of Object.entries(AQI_LEVELS)) {
        if (aqi <= level.max) return level;
    }
    return AQI_LEVELS.hazardous;
}

/**
 * Update atmospheric metrics
 */
function updateAtmosphericMetrics(data) {
    if (!data?.current) {
        console.warn('[Weather] No atmospheric data');
        return;
    }

    const current = data.current;

    console.log('[Weather] Atmospheric metrics:', {
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
        pressure: current.pressure_msl,
        clouds: current.cloud_cover,
        uv: current.uv_index
    });

    // Safe number formatting
    const safeRound = (val) => val !== undefined && val !== null ? Math.round(val) : '--';

    setText('humidityValue', `${safeRound(current.relative_humidity_2m)}%`);
    setText('windValue', `${safeRound(current.wind_speed_10m)} km/h`);
    setText('pressureValue', `${safeRound(current.pressure_msl)} hPa`);
    setText('cloudValue', `${safeRound(current.cloud_cover)}%`);
    setText('uvValue', current.uv_index !== undefined ? current.uv_index.toFixed(1) : '--');

    // Visibility (not in current API, estimate from weather)
    const visibility = estimateVisibility(current.weather_code, current.relative_humidity_2m);
    setText('visibilityValue', `${visibility} km`);

    // Wind direction compass
    const windArrow = document.getElementById('windArrow');
    if (windArrow && current.wind_direction_10m !== undefined) {
        windArrow.setAttribute('transform', `rotate(${current.wind_direction_10m} 20 20)`);
    }
}

/**
 * Estimate visibility based on weather conditions
 */
function estimateVisibility(weatherCode, humidity) {
    if (weatherCode >= 45 && weatherCode <= 48) return 1; // Fog
    if (weatherCode >= 95) return 5; // Thunderstorm
    if (weatherCode >= 61 && weatherCode <= 67) return 8; // Rain
    if (humidity > 90) return 10;
    if (humidity > 70) return 15;
    return 20;
}

/**
 * Update hourly forecast
 */
function updateHourlyForecast(data) {
    console.log('[Weather] updateHourlyForecast called');

    if (!data?.hourly) {
        console.warn('[Weather] No hourly data available');
        return;
    }

    const hourly = data.hourly;
    console.log('[Weather] Hourly data has', hourly.time?.length, 'entries');

    const container = document.getElementById('hourlyScroll');
    if (!container) {
        console.warn('[Weather] Hourly scroll container not found');
        return;
    }
    console.log('[Weather] Hourly container found');

    if (!hourly.time || hourly.time.length === 0) {
        console.warn('[Weather] No hourly time data');
        return;
    }

    // Get current time in Johannesburg timezone
    const now = new Date();
    console.log('[Weather] Current time:', now.toISOString(), 'Local:', now.toLocaleString('en-ZA'));

    // Parse API times correctly (they're in local timezone without offset)
    // Open-Meteo returns times like "2025-12-27T19:00" which are already local
    const currentHour = now.getHours();
    const currentDate = now.getDate();

    // Find the entry matching current hour, or the closest past hour
    let startIndex = 0;
    for (let i = 0; i < hourly.time.length; i++) {
        // Parse without timezone conversion - treat as local time
        const timeStr = hourly.time[i];
        const [datePart, timePart] = timeStr.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour] = timePart.split(':').map(Number);

        // Check if this is current or earlier hour on same day or future days
        if (day === currentDate && hour <= currentHour) {
            startIndex = i;
        } else if (day > currentDate || (day === currentDate && hour > currentHour)) {
            // We've gone past current time, use previous index or this one
            if (startIndex === 0 && i > 0) startIndex = i - 1;
            break;
        }
    }

    // If we didn't find a good match, just start from current hour index roughly
    if (startIndex === 0) {
        startIndex = Math.max(0, currentHour);
    }

    console.log(`[Weather] Hourly forecast starting at index ${startIndex}, time: ${hourly.time[startIndex]}`);

    // Generate 24 hourly items
    let html = '';
    let itemCount = 0;
    for (let i = 0; i < 24; i++) {
        const idx = startIndex + i;
        if (idx >= hourly.time.length) break;

        const timeStr = hourly.time[idx];
        const [, timePart] = timeStr.split('T');
        const hourNum = timePart.split(':')[0];

        const temp = Math.round(hourly.temperature_2m[idx]);
        const weatherCode = hourly.weather_code[idx];
        const precip = hourly.precipitation_probability?.[idx] || 0;
        const isNow = i === 0;
        const isDay = hourly.is_day?.[idx] ?? true;

        const weatherInfo = WMO_CODES[weatherCode] || { icon: 'cloud' };
        const displayTime = isNow ? 'Now' : hourNum;

        html += `
            <div class="hourly-item ${isNow ? 'now' : ''}">
                <span class="hourly-time">${displayTime}</span>
                <div class="hourly-icon">${getSmallIcon(weatherInfo.icon, isDay)}</div>
                <span class="hourly-temp">${temp}°</span>
                ${precip > 0 ? `<span class="hourly-precip">${precip}%</span>` : ''}
            </div>
        `;
        itemCount++;
    }

    console.log(`[Weather] Generated ${itemCount} hourly items`);
    container.innerHTML = html;

    if (itemCount === 0) {
        container.innerHTML = '<div class="text-white/50 text-sm p-4">Loading forecast...</div>';
    }
}

/**
 * Get small weather icon
 */
function getSmallIcon(iconType, isDay = true) {
    const color = iconType.includes('sun') || iconType === 'sun' ? '#fbbf24' :
                  iconType.includes('rain') || iconType.includes('drizzle') || iconType.includes('shower') ? '#3b82f6' :
                  iconType.includes('snow') ? '#e0f2fe' :
                  iconType.includes('thunder') || iconType.includes('storm') ? '#a855f7' :
                  '#94a3b8';

    if (iconType === 'sun') {
        return `<svg class="w-full h-full" fill="${color}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>`;
    }
    return `<svg class="w-full h-full" fill="${color}" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`;
}

/**
 * Update weekly forecast
 */
function updateWeeklyForecast(data) {
    if (!data?.daily) return;

    const daily = data.daily;
    const container = document.getElementById('weeklyForecast');
    if (!container) return;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Today' : days[date.getDay()];
        const high = Math.round(daily.temperature_2m_max[i]);
        const low = Math.round(daily.temperature_2m_min[i]);
        const weatherCode = daily.weather_code[i];
        const precip = daily.precipitation_probability_max?.[i] || 0;

        const weatherInfo = WMO_CODES[weatherCode] || { icon: 'cloud' };

        html += `
            <div class="daily-item ${i === 0 ? 'today' : ''}">
                <span class="daily-day">${dayName}</span>
                <div class="daily-icon">${getSmallIcon(weatherInfo.icon)}</div>
                <div class="daily-temps">
                    <span class="daily-high">${high}°</span>
                    <span class="daily-low">${low}°</span>
                </div>
                ${precip > 20 ? `<span class="daily-precip">${precip}%</span>` : ''}
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Update sun times
 */
function updateSunTimes(data) {
    if (!data?.daily) return;

    const sunrise = data.daily.sunrise?.[0];
    const sunset = data.daily.sunset?.[0];

    if (sunrise) {
        const sunriseTime = new Date(sunrise);
        setText('sunriseTime', sunriseTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }));
    }

    if (sunset) {
        const sunsetTime = new Date(sunset);
        setText('sunsetTime', sunsetTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }));
    }

    // Update sun arc position
    if (sunrise && sunset) {
        updateSunArc(new Date(sunrise), new Date(sunset));
    }
}

/**
 * Update sun arc visualization
 */
function updateSunArc(sunrise, sunset) {
    const now = new Date();
    const sunriseMs = sunrise.getTime();
    const sunsetMs = sunset.getTime();
    const nowMs = now.getTime();

    // Calculate progress (0 to 1)
    let progress = 0;
    if (nowMs >= sunriseMs && nowMs <= sunsetMs) {
        progress = (nowMs - sunriseMs) / (sunsetMs - sunriseMs);
    } else if (nowMs > sunsetMs) {
        progress = 1;
    }

    // Update arc
    const arcProgress = document.getElementById('sunArcProgress');
    const sunPosition = document.getElementById('sunPosition');

    if (arcProgress) {
        const dashOffset = 140 - (140 * progress);
        arcProgress.style.strokeDashoffset = dashOffset;
    }

    if (sunPosition) {
        // Calculate position along the arc
        const angle = Math.PI * progress;
        const x = 5 + 90 * progress;
        const y = 45 - Math.sin(angle) * 40;
        sunPosition.setAttribute('cx', x);
        sunPosition.setAttribute('cy', y);
    }
}

/**
 * Update historical comparison
 */
function updateHistoricalComparison(currentData, historicalData) {
    if (!currentData?.current || !historicalData?.hourly) return;

    const current = currentData.current;
    const historical = historicalData.hourly;

    // Find matching hour from yesterday
    const now = new Date();
    const currentHour = now.getHours();
    const yesterdayTemp = historical.temperature_2m?.[currentHour] || current.temperature_2m;
    const yesterdayHumidity = historical.relative_humidity_2m?.[currentHour] || current.relative_humidity_2m;
    const yesterdayWind = historical.wind_speed_10m?.[currentHour] || current.wind_speed_10m;

    // Calculate differences
    const tempDiff = Math.round(current.temperature_2m - yesterdayTemp);
    const humidityDiff = Math.round(current.relative_humidity_2m - yesterdayHumidity);
    const windDiff = Math.round(current.wind_speed_10m - yesterdayWind);

    // Update display
    updateDiffDisplay('tempDiff', tempDiff, '°');
    updateDiffDisplay('humidityDiff', humidityDiff, '%');
    updateDiffDisplay('windDiff', windDiff, '');
}

/**
 * Update difference display with coloring
 */
function updateDiffDisplay(elementId, diff, suffix) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const prefix = diff > 0 ? '+' : '';
    el.textContent = `${prefix}${diff}${suffix}`;
    el.className = 'history-diff';

    if (diff > 0) el.classList.add('positive');
    else if (diff < 0) el.classList.add('negative');
    else el.classList.add('neutral');
}

// Weather alerts are now handled by updateGovernmentAlerts() using One Call 3.0 real alerts

/**
 * Update weather-reactive background
 */
function updateWeatherBackground(data) {
    const view = document.getElementById('view-weather');
    if (!view) return;

    // Remove existing weather classes
    view.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-stormy', 'weather-snowy');

    const weatherCode = data?.current?.weather_code;
    if (weatherCode === undefined) return;

    const weatherInfo = WMO_CODES[weatherCode];
    if (weatherInfo?.class) {
        view.classList.add(`weather-${weatherInfo.class}`);
    }

    // Trigger particle effects if available
    if (window.WeatherEffects) {
        window.WeatherEffects.setWeatherType(weatherInfo?.class || 'clear');
    }
}

/**
 * Update header weather badge
 */
function updateHeaderBadge(data) {
    if (!data?.current) return;

    const temp = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weather_code;
    const weatherInfo = WMO_CODES[weatherCode] || { text: 'Unknown' };

    // Update header elements (if they exist)
    const tempEl = document.getElementById('weatherTemp');
    const conditionEl = document.getElementById('weatherCondition');

    if (tempEl) tempEl.textContent = `${temp}°`;
    if (conditionEl) conditionEl.textContent = weatherInfo.text;
}

/**
 * Initialize radar map with Leaflet
 */
async function initRadarMap() {
    const container = document.getElementById('radarMap');
    if (!container || radarMap) return;

    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.warn('[Weather] Leaflet not loaded, radar map disabled');
        return;
    }

    try {
        // Create map
        radarMap = L.map('radarMap', {
            center: [LOCATION.lat, LOCATION.lon],
            zoom: 7,
            zoomControl: true,
            attributionControl: false
        });

        // Add dark tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(radarMap);

        // Fetch RainViewer radar data
        await loadRadarFrames();

        // Remove loading indicator
        const loadingEl = container.querySelector('.radar-loading');
        if (loadingEl) loadingEl.remove();

    } catch (error) {
        console.error('[Weather] Error initializing radar map:', error);
    }
}

/**
 * Load radar frames from RainViewer
 */
async function loadRadarFrames() {
    try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();

        if (!data?.radar?.past) return;

        // Clear existing layers
        radarLayers.forEach(layer => radarMap.removeLayer(layer));
        radarLayers = [];

        // Add radar layers (past + nowcast)
        const frames = [...data.radar.past, ...(data.radar.nowcast || [])];

        frames.forEach((frame, index) => {
            const layer = L.tileLayer(`https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
                opacity: index === frames.length - 1 ? 0.6 : 0
            });
            layer.addTo(radarMap);
            radarLayers.push(layer);
        });

        // Show latest frame
        radarAnimationIndex = radarLayers.length - 1;

    } catch (error) {
        console.error('[Weather] Error loading radar frames:', error);
    }
}

/**
 * Toggle radar animation
 */
function toggleRadarAnimation() {
    if (radarAnimationPlaying) {
        // Stop animation
        clearInterval(radarAnimationInterval);
        radarAnimationPlaying = false;

        const btn = document.getElementById('radarPlayBtn');
        if (btn) {
            btn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        }
    } else {
        // Start animation
        radarAnimationPlaying = true;
        radarAnimationIndex = 0;

        const btn = document.getElementById('radarPlayBtn');
        if (btn) {
            btn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;
        }

        radarAnimationInterval = setInterval(() => {
            // Hide all layers
            radarLayers.forEach(layer => layer.setOpacity(0));

            // Show current frame
            if (radarLayers[radarAnimationIndex]) {
                radarLayers[radarAnimationIndex].setOpacity(0.6);
            }

            // Advance to next frame
            radarAnimationIndex = (radarAnimationIndex + 1) % radarLayers.length;
        }, 500);
    }
}

/**
 * Helper to set text content safely with debugging
 */
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    } else {
        console.warn(`[Weather] Element not found: ${id}`);
    }
}

// Listen for view loaded event (check both window and document, both view and viewName)
function handleViewLoaded(e) {
    const view = e.detail?.view || e.detail?.viewName;
    if (view === 'weather') {
        console.log('[Weather] View loaded event received, initializing...');
        initWeather();
    }
}

document.addEventListener('viewLoaded', handleViewLoaded);
window.addEventListener('viewLoaded', handleViewLoaded);

// Also initialize immediately if the view is already visible (for page refresh scenarios)
document.addEventListener('DOMContentLoaded', () => {
    const weatherView = document.getElementById('view-weather');
    if (weatherView && !weatherView.classList.contains('hidden')) {
        console.log('[Weather] View already visible, initializing...');
        initWeather();
    }
});

// Export for global access
window.WeatherDashboard = {
    init: initWeather,
    refresh: fetchAllWeatherData,
    isInitialized: () => weatherCache.lastFetch > 0
};
