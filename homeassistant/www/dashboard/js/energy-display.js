/**
 * Energy Display Module
 * Large wall-mounted tablet display for energy monitoring
 */

import { state } from './state.js';
import { ENERGY_SENSORS } from './config.js';
import { $ } from './utils.js';
import { fetchHistory } from './api.js';

// ============================================
// CONFIGURATION
// ============================================

const APPLIANCE_CONFIG = {
    geyser: {
        powerId: 'sensor.sonoff_10018908af_power',
        switchId: 'switch.sonoff_10018908af',
        elementId: 'applianceGeyser',
        threshold: 50, // Watts to consider "on"
        highPowerThreshold: 2000
    },
    pool: {
        powerId: 'sensor.sonoff_10017f2d90_power',
        switchId: 'switch.sonoff_10017f2d90_1',
        elementId: 'appliancePool',
        threshold: 50,
        highPowerThreshold: 1000
    },
    washer: {
        powerId: 'sensor.sonoff_100241aae6_power',
        elementId: 'applianceWasher',
        threshold: 10,
        highPowerThreshold: 500
    },
    dishwasher: {
        powerId: 'sensor.sonoff_100241ac8a_power',
        elementId: 'applianceDishwasher',
        threshold: 10,
        highPowerThreshold: 500
    }
};

const MAX_GRID_POWER = 7000;    // 7kW max for gauge
const MAX_SOLAR_POWER = 4000;   // 4kW max for gauge
const MAX_BATTERY_POWER = 5000; // 5kW max for gauge
const MAX_LOAD_POWER = 5000;    // 5kW max for gauge

let trendChart = null;
let updateInterval = null;
let historyData = {
    solar: [],
    load: [],
    grid: []
};

// ============================================
// INITIALIZATION
// ============================================

export function initEnergyDisplay() {
    console.log('Initializing Energy Display...');

    // Start update loop
    updateDisplay();

    // Initialize trend chart
    initTrendChart();

    // Load historical data
    loadHistoricalData();

    // Set up periodic updates
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateDisplay, 2000);

    // Update time display
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
}

export function destroyEnergyDisplay() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }
}

// ============================================
// DISPLAY UPDATES
// ============================================

function updateDisplay() {
    updateGauges();
    updateBattery();
    updateAppliances();
    updateGridStatus();
}

function updateTimeDisplay() {
    const el = $('energyDisplayTime');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    }
}

// ============================================
// GAUGE UPDATES
// ============================================

function updateGauges() {
    const gridPower = parseFloat(state.getEntityState(ENERGY_SENSORS.gridPower)) || 0;
    const solarPower = parseFloat(state.getEntityState(ENERGY_SENSORS.solarPower)) || 0;
    const loadPower = parseFloat(state.getEntityState(ENERGY_SENSORS.loadPower)) || 0;
    const batteryPower = parseFloat(state.getEntityState(ENERGY_SENSORS.batteryPower)) || 0;

    // Grid Load Gauge
    updateGauge('gridLoad', Math.abs(gridPower), MAX_GRID_POWER, gridPower >= 0 ? 'IMPORTING' : 'EXPORTING');

    // Solar Production Gauge
    updateGauge('solarProd', solarPower, MAX_SOLAR_POWER, solarPower > 0 ? 'GENERATING' : 'IDLE');

    // Battery Output Gauge (positive = discharging/powering home, negative = charging)
    const batteryStatus = batteryPower > 10 ? 'DISCHARGING' : batteryPower < -10 ? 'CHARGING' : 'IDLE';
    updateGauge('batteryOutput', Math.abs(batteryPower), MAX_BATTERY_POWER, batteryStatus);

    // Home Consumption Gauge
    updateGauge('loadCons', loadPower, MAX_LOAD_POWER, 'CONSUMING');

    // Update gauge card classes based on state
    const gridCard = document.querySelector('.grid-gauge');
    if (gridCard) {
        gridCard.classList.toggle('exporting', gridPower < 0);
    }

    // Update battery gauge color based on charging/discharging
    const batteryGaugeArc = $('batteryOutputArc');
    if (batteryGaugeArc) {
        batteryGaugeArc.style.stroke = batteryPower < -10 ? '#3b82f6' : '#10b981'; // Blue when charging, green when discharging
    }
}

function updateGauge(prefix, value, max, statusText) {
    const arcEl = $(`${prefix}Arc`);
    const valueEl = $(`${prefix}Value`);
    const statusEl = $(`${prefix}Direction`) || $(`${prefix}Status`);

    // Update value display
    if (valueEl) {
        valueEl.textContent = formatPower(value);
    }

    // Update status text
    if (statusEl) {
        statusEl.textContent = statusText;
    }

    // Update arc
    if (arcEl) {
        const arcLength = 251.3; // Circumference of the arc
        const percentage = Math.min(value / max, 1);
        const offset = arcLength * (1 - percentage);
        arcEl.style.strokeDashoffset = offset;
    }
}

function formatPower(watts) {
    // Always display in watts (no k notation)
    return Math.round(watts).toString();
}

// ============================================
// BATTERY UPDATE
// ============================================

function updateBattery() {
    const batteryPercent = parseFloat(state.getEntityState(ENERGY_SENSORS.batteryPercent)) || 0;
    const batteryPower = parseFloat(state.getEntityState(ENERGY_SENSORS.batteryPower)) || 0;
    const batteryState = state.getEntityState(ENERGY_SENSORS.batteryState) || 'idle';

    // Update display elements
    const percentEl = $('batteryDisplayPercent');
    const stateEl = $('batteryDisplayState');
    const powerEl = $('batteryDisplayPower');
    const barEl = $('batteryDisplayBar');
    const containerEl = document.querySelector('.battery-bar-container');

    if (percentEl) {
        percentEl.textContent = `${Math.round(batteryPercent)}%`;
        // Color based on level
        percentEl.classList.remove('text-emerald-400', 'text-amber-400', 'text-red-400');
        if (batteryPercent <= 20) {
            percentEl.classList.add('text-red-400');
        } else if (batteryPercent <= 40) {
            percentEl.classList.add('text-amber-400');
        } else {
            percentEl.classList.add('text-emerald-400');
        }
    }

    if (stateEl) {
        let stateText = 'IDLE';
        if (batteryState.toLowerCase().includes('charg')) {
            stateText = 'CHARGING';
        } else if (batteryState.toLowerCase().includes('discharg')) {
            stateText = 'DISCHARGING';
        }
        stateEl.textContent = stateText;
    }

    if (powerEl) {
        const sign = batteryPower > 0 ? '+' : '';
        powerEl.textContent = `${sign}${Math.round(batteryPower)}W`;
    }

    if (barEl) {
        barEl.style.width = `${Math.min(batteryPercent, 100)}%`;
    }

    // Low battery warning
    if (containerEl) {
        containerEl.classList.toggle('low-battery', batteryPercent <= 30);
    }
}

// ============================================
// APPLIANCE INDICATORS
// ============================================

function updateAppliances() {
    let anyActive = false;

    Object.entries(APPLIANCE_CONFIG).forEach(([name, config]) => {
        const power = parseFloat(state.getEntityState(config.powerId)) || 0;
        const el = $(config.elementId);

        if (!el) return;

        const isActive = power >= config.threshold;
        const isHighPower = power >= config.highPowerThreshold;

        // Toggle visibility
        el.classList.toggle('hidden', !isActive);
        el.classList.toggle('active', isActive);
        el.classList.toggle('high-power', isHighPower);

        // Update power display (check all possible class names)
        const powerDisplay = el.querySelector('.appliance-mega-power') ||
                            el.querySelector('.appliance-power-display-sm') ||
                            el.querySelector('.appliance-power-display');
        if (powerDisplay) {
            powerDisplay.textContent = `${Math.round(power)}W`;
        }

        // Store power for sorting
        el.dataset.power = power;

        if (isActive) anyActive = true;
    });

    // Sort appliances by power (highest first)
    const container = $('activeAppliancesContainer');
    if (container) {
        // Match all indicator classes
        const appliances = Array.from(container.querySelectorAll('.appliance-mega:not(.hidden), .appliance-indicator-sm:not(.hidden), .appliance-indicator:not(.hidden)'));
        appliances.sort((a, b) => parseFloat(b.dataset.power) - parseFloat(a.dataset.power));
        appliances.forEach(el => container.appendChild(el));

        // Show/hide "no loads" message
        const noLoadsEl = $('noActiveLoads');
        if (noLoadsEl) {
            noLoadsEl.classList.toggle('hidden', anyActive);
        }
    }
}

// ============================================
// GRID CONNECTION STATUS
// ============================================

function updateGridStatus() {
    const gridVoltage = parseFloat(state.getEntityState(ENERGY_SENSORS.gridVoltage)) || 0;
    const gridFrequency = parseFloat(state.getEntityState(ENERGY_SENSORS.gridFrequency)) || 0;

    // Grid is considered disconnected if voltage is very low (< 100V) or frequency is 0
    const isDisconnected = gridVoltage < 100 || gridFrequency < 45;

    const statusEl = $('gridConnectionStatus');
    if (statusEl) {
        statusEl.classList.toggle('disconnected', isDisconnected);
        const textEl = statusEl.querySelector('span:last-child');
        if (textEl) {
            textEl.textContent = isDisconnected ? 'GRID DISCONNECTED' : 'GRID CONNECTED';
        }
    }
}

// ============================================
// TREND CHART
// ============================================

let chartInitAttempts = 0;
const MAX_CHART_INIT_ATTEMPTS = 20;

function initTrendChart() {
    const chartEl = $('displayTrendChart');
    if (!chartEl || typeof ApexCharts === 'undefined') {
        console.warn('Chart element or ApexCharts not ready, retrying...');
        setTimeout(initTrendChart, 500);
        return;
    }

    // Ensure container has dimensions before rendering
    if (chartEl.offsetWidth === 0 || chartEl.offsetHeight === 0) {
        chartInitAttempts++;
        if (chartInitAttempts < MAX_CHART_INIT_ATTEMPTS) {
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => setTimeout(initTrendChart, 250));
            return;
        }
        // After max attempts, force a minimum size and continue
        console.warn('Chart container still has no size after retries, using fallback');
        chartEl.style.minHeight = '150px';
    }

    chartInitAttempts = 0;
    console.log('Initializing trend chart, container size:', chartEl.offsetWidth, 'x', chartEl.offsetHeight);

    const options = {
        chart: {
            type: 'area',
            height: '100%',
            width: '100%',
            background: 'transparent',
            toolbar: { show: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 500
            },
            zoom: { enabled: false },
            redrawOnParentResize: true,
            redrawOnWindowResize: true
        },
        colors: ['#f59e0b', '#a855f7', '#3b82f6'],
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 0.3,
                opacityFrom: 0.15,
                opacityTo: 0.02,
                stops: [0, 100]
            }
        },
        series: [
            { name: 'Solar', data: [] },
            { name: 'Load', data: [] },
            { name: 'Grid', data: [] }
        ],
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: 'rgba(255,255,255,0.4)', fontSize: '12px' },
                datetimeFormatter: {
                    hour: 'HH:mm'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: 'rgba(255,255,255,0.4)', fontSize: '12px' },
                formatter: (val) => `${Math.round(val)}W`
            },
            min: 0
        },
        grid: {
            borderColor: 'rgba(255,255,255,0.05)',
            strokeDashArray: 4
        },
        legend: { show: false },
        tooltip: {
            theme: 'dark',
            x: { format: 'HH:mm' },
            y: { formatter: (val) => `${Math.round(val)}W` }
        }
    };

    trendChart = new ApexCharts(chartEl, options);
    trendChart.render();
}

async function loadHistoricalData() {
    // Check if connected
    if (!state.authenticated || !state.ws) {
        console.log('Waiting for connection before loading history...');
        // Subscribe to state updates when connected
        const handler = () => {
            state.off('statesUpdated', handler);
            setTimeout(loadHistoricalData, 500);
        };
        state.on('statesUpdated', handler);
        return;
    }

    try {
        console.log('Fetching power history for trend chart...');

        // Use the existing fetchHistory from api.js - fetch 24 hours for full day view
        const history = await fetchHistory([
            ENERGY_SENSORS.solarPower,
            ENERGY_SENSORS.loadPower,
            ENERGY_SENSORS.gridPower
        ], 24);

        // Transform to ApexCharts format
        const solarData = (history[ENERGY_SENSORS.solarPower] || []).map(e => ({ x: e.timestamp, y: e.state }));
        const loadData = (history[ENERGY_SENSORS.loadPower] || []).map(e => ({ x: e.timestamp, y: e.state }));
        const gridData = (history[ENERGY_SENSORS.gridPower] || []).map(e => ({ x: e.timestamp, y: Math.abs(e.state) }));

        console.log('History loaded:', { solar: solarData.length, load: loadData.length, grid: gridData.length });

        if (trendChart) {
            trendChart.updateSeries([
                { name: 'Solar', data: solarData },
                { name: 'Load', data: loadData },
                { name: 'Grid', data: gridData }
            ]);
        }

    } catch (error) {
        console.error('Failed to load historical data:', error);
        // Retry after delay
        setTimeout(loadHistoricalData, 5000);
    }
}

// ============================================
// EXPORTS
// ============================================

export default {
    initEnergyDisplay,
    destroyEnergyDisplay
};
