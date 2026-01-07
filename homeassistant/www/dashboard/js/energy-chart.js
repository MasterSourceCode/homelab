/**
 * Energy Chart Module
 * Futuristic 6-hour power trend visualization using Home Assistant history
 * Data is fetched from HA's recorder - no localStorage needed
 */

import { fetchHistory } from './api.js';
import { ENERGY_SENSORS } from './config.js';

// ============================================
// CONFIGURATION
// ============================================

// Chart configuration
const CHART_CONFIG = {
    hoursToShow: 6,
    maxPower: 8000,         // 8kW max for scale
    colors: {
        actual: { stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.1)', glow: 'rgba(34, 211, 238, 0.6)' },
        average: { stroke: 'rgba(168, 85, 247, 0.5)', fill: 'rgba(168, 85, 247, 0.05)' },
        grid: 'rgba(255, 255, 255, 0.03)',
        gridAccent: 'rgba(6, 182, 212, 0.1)'
    }
};

// ============================================
// STATE
// ============================================

// Power history: array of { timestamp, load, solar, grid, battery }
let powerHistory = [];

// Chart canvas and context
let chartCanvas = null;
let chartCtx = null;
let historyLoaded = false;

// ============================================
// INITIALIZATION
// ============================================

export function initEnergyChart() {
    chartCanvas = document.getElementById('energyTrendChart');
    if (!chartCanvas) return;

    chartCtx = chartCanvas.getContext('2d');

    // Initial resize and render
    resizeChart();

    // Handle resize
    window.addEventListener('resize', debounce(resizeChart, 250));
}

/**
 * Load historical data from Home Assistant
 * Call this after WebSocket connection is established
 * @param {boolean} force - Force refresh even if already loaded
 */
export async function loadHistoryFromHA(force = false) {
    if (historyLoaded && !force) return;

    try {
        console.log('Fetching power history from Home Assistant...');
        const startTime = performance.now();

        // Fetch history for load power sensor
        const history = await fetchHistory([ENERGY_SENSORS.loadPower], 6);
        const loadHistory = history[ENERGY_SENSORS.loadPower] || [];

        // Convert to our format
        powerHistory = loadHistory.map(entry => ({
            timestamp: entry.timestamp,
            load: entry.state,
            solar: 0,
            grid: 0,
            battery: 0
        }));

        const elapsed = Math.round(performance.now() - startTime);
        console.log(`Loaded ${powerHistory.length} history points in ${elapsed}ms`);

        historyLoaded = true;
        renderChart();
    } catch (error) {
        console.warn('Failed to load history from HA:', error.message);
        // Chart will still work with real-time data
    }
}

/**
 * Refresh history data - call when energy view becomes visible
 */
export async function refreshHistory() {
    await loadHistoryFromHA(true);
}

// ============================================
// DATA MANAGEMENT
// ============================================

export function recordPowerData(data) {
    const now = Date.now();
    const { loadPower, solarPower, gridPower, batteryPower } = data;

    // Add to power history
    powerHistory.push({
        timestamp: now,
        load: loadPower || 0,
        solar: solarPower || 0,
        grid: gridPower || 0,
        battery: batteryPower || 0
    });

    // Trim old data (keep 7 hours for smooth scrolling)
    const cutoff = now - (7 * 60 * 60 * 1000);
    powerHistory = powerHistory.filter(p => p.timestamp > cutoff);

    // Re-render chart
    renderChart();
}

// ============================================
// CHART RENDERING
// ============================================

function renderChart() {
    if (!chartCtx || !chartCanvas) return;

    const width = chartCanvas.clientWidth;
    const height = chartCanvas.clientHeight;
    if (width === 0 || height === 0) return;

    const padding = { left: 45, right: 20, top: 20, bottom: 25 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    chartCtx.clearRect(0, 0, width, height);

    const now = Date.now();
    const maxWindowMs = 6 * 60 * 60 * 1000; // 6 hours max

    // Get data within 6-hour window
    const sixHoursAgo = now - maxWindowMs;
    const filteredHistory = powerHistory.filter(p => p.timestamp >= sixHoursAgo);

    if (filteredHistory.length === 0) {
        // No data - draw empty grid
        drawGrid(padding, chartWidth, chartHeight);
        updateYAxisLabels(500);
        updateTimeLabels(now, 60 * 60 * 1000);
        return;
    }

    // Calculate actual time range of data
    const dataStartTime = filteredHistory[0].timestamp;
    const dataEndTime = filteredHistory[filteredHistory.length - 1].timestamp;
    const dataSpanMs = dataEndTime - dataStartTime;

    // Determine display window: use data span with padding, min 5 mins, max 6 hours
    const minWindowMs = 5 * 60 * 1000;
    let displayWindowMs = Math.max(dataSpanMs * 1.1, minWindowMs);
    displayWindowMs = Math.min(displayWindowMs, maxWindowMs);

    // Round to nice time intervals
    if (displayWindowMs <= 10 * 60 * 1000) {
        displayWindowMs = 10 * 60 * 1000;
    } else if (displayWindowMs <= 30 * 60 * 1000) {
        displayWindowMs = 30 * 60 * 1000;
    } else if (displayWindowMs <= 60 * 60 * 1000) {
        displayWindowMs = 60 * 60 * 1000;
    } else if (displayWindowMs <= 2 * 60 * 60 * 1000) {
        displayWindowMs = 2 * 60 * 60 * 1000;
    } else if (displayWindowMs <= 4 * 60 * 60 * 1000) {
        displayWindowMs = 4 * 60 * 60 * 1000;
    } else {
        displayWindowMs = 6 * 60 * 60 * 1000;
    }

    const windowStart = now - displayWindowMs;

    // Draw background grid
    drawGrid(padding, chartWidth, chartHeight);

    // Map data to chart coordinates
    const actualData = filteredHistory
        .filter(p => p.timestamp >= windowStart)
        .map(p => ({
            x: (p.timestamp - windowStart) / displayWindowMs,
            y: p.load
        }));

    // Calculate Y-axis scaling from actual data
    const allValues = actualData.map(d => d.y);
    const dataMax = allValues.length > 0 ? Math.max(...allValues) : 500;

    // Add 15% padding above max
    let maxValue = dataMax * 1.15;

    // Round to nice values
    if (maxValue <= 100) {
        maxValue = Math.ceil(maxValue / 50) * 50;
    } else if (maxValue <= 500) {
        maxValue = Math.ceil(maxValue / 100) * 100;
    } else if (maxValue <= 2000) {
        maxValue = Math.ceil(maxValue / 250) * 250;
    } else {
        maxValue = Math.ceil(maxValue / 500) * 500;
    }
    maxValue = Math.max(maxValue, 100);

    // Update Y-axis labels
    updateYAxisLabels(maxValue);

    // Draw actual power line with glow
    if (actualData.length > 1) {
        drawLine(actualData, padding, chartWidth, chartHeight, maxValue, CHART_CONFIG.colors.actual, true);
    }

    // Draw current value indicator
    if (actualData.length > 0) {
        const lastPoint = actualData[actualData.length - 1];
        const x = padding.left + lastPoint.x * chartWidth;
        const y = padding.top + chartHeight - (lastPoint.y / maxValue) * chartHeight;
        drawCurrentIndicator(x, y, lastPoint.y);
    }

    // Update time labels with actual window
    updateTimeLabels(now, displayWindowMs);
}

function drawGrid(padding, chartWidth, chartHeight) {
    chartCtx.strokeStyle = CHART_CONFIG.colors.grid;
    chartCtx.lineWidth = 1;

    // Horizontal grid lines (4 lines)
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (i / 4) * chartHeight;
        chartCtx.beginPath();
        chartCtx.moveTo(padding.left, y);
        chartCtx.lineTo(padding.left + chartWidth, y);
        chartCtx.stroke();
    }

    // Vertical grid lines (6 lines for each hour)
    chartCtx.strokeStyle = CHART_CONFIG.colors.gridAccent;
    for (let i = 0; i <= 6; i++) {
        const x = padding.left + (i / 6) * chartWidth;
        chartCtx.beginPath();
        chartCtx.moveTo(x, padding.top);
        chartCtx.lineTo(x, padding.top + chartHeight);
        chartCtx.stroke();
    }
}

function drawLine(data, padding, chartWidth, chartHeight, maxValue, colors, withGlow) {
    if (data.length < 2) return;

    const points = data.map(d => ({
        x: padding.left + d.x * chartWidth,
        y: padding.top + chartHeight - (Math.min(d.y, maxValue) / maxValue) * chartHeight
    }));

    // Draw glow effect for actual line
    if (withGlow) {
        chartCtx.save();
        chartCtx.shadowColor = colors.glow;
        chartCtx.shadowBlur = 15;
        chartCtx.strokeStyle = colors.stroke;
        chartCtx.lineWidth = 2;
        chartCtx.beginPath();
        chartCtx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            chartCtx.lineTo(points[i].x, points[i].y);
        }
        chartCtx.stroke();
        chartCtx.restore();
    }

    // Draw fill gradient
    const gradient = chartCtx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, colors.fill);
    gradient.addColorStop(1, 'transparent');

    chartCtx.fillStyle = gradient;
    chartCtx.beginPath();
    chartCtx.moveTo(points[0].x, padding.top + chartHeight);
    chartCtx.lineTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        chartCtx.lineTo(points[i].x, points[i].y);
    }

    chartCtx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    chartCtx.closePath();
    chartCtx.fill();

    // Draw line
    chartCtx.strokeStyle = colors.stroke;
    chartCtx.lineWidth = withGlow ? 2.5 : 1.5;
    chartCtx.lineCap = 'round';
    chartCtx.lineJoin = 'round';
    chartCtx.beginPath();
    chartCtx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        chartCtx.lineTo(points[i].x, points[i].y);
    }
    chartCtx.stroke();
}

function drawCurrentIndicator(x, y, value) {
    // Draw pulsing dot
    chartCtx.save();

    // Outer glow
    chartCtx.beginPath();
    chartCtx.arc(x, y, 8, 0, Math.PI * 2);
    chartCtx.fillStyle = 'rgba(34, 211, 238, 0.2)';
    chartCtx.fill();

    // Inner dot
    chartCtx.beginPath();
    chartCtx.arc(x, y, 4, 0, Math.PI * 2);
    chartCtx.fillStyle = '#22d3ee';
    chartCtx.shadowColor = 'rgba(34, 211, 238, 0.8)';
    chartCtx.shadowBlur = 10;
    chartCtx.fill();

    chartCtx.restore();
}

function updateYAxisLabels(maxValue) {
    const maxEl = document.getElementById('chartYMax');
    const midEl = document.getElementById('chartYMid');

    if (maxEl) maxEl.textContent = formatPowerShort(maxValue);
    if (midEl) midEl.textContent = formatPowerShort(maxValue / 2);
}

function updateTimeLabels(nowMs, windowMs) {
    const windowStart = nowMs - windowMs;

    const formatTime = (timestamp) => {
        const d = new Date(timestamp);
        if (windowMs <= 60 * 60 * 1000) {
            return d.getHours().toString().padStart(2, '0') + ':' +
                   d.getMinutes().toString().padStart(2, '0');
        } else {
            return d.getHours().toString().padStart(2, '0') + ':00';
        }
    };

    // Update the 7 time labels (0-5 plus "Now")
    for (let i = 0; i < 6; i++) {
        const el = document.getElementById(`chartT${i}`);
        if (el) {
            const t = windowStart + (i / 6) * windowMs;
            el.textContent = formatTime(t);
        }
    }
}

// ============================================
// UTILITIES
// ============================================

function formatPowerShort(watts) {
    if (watts >= 1000) {
        return (watts / 1000).toFixed(0) + 'kW';
    }
    return Math.round(watts) + 'W';
}

function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Force resize and re-render (call when view becomes visible)
export function resizeChart() {
    if (!chartCanvas) {
        chartCanvas = document.getElementById('energyTrendChart');
        if (!chartCanvas) return;
        chartCtx = chartCanvas.getContext('2d');
    }

    // Use parent container dimensions
    const container = document.getElementById('chartContainer') || chartCanvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Only resize if we have actual dimensions
    if (rect.width > 0 && rect.height > 0) {
        chartCanvas.width = rect.width * dpr;
        chartCanvas.height = rect.height * dpr;
        chartCanvas.style.width = rect.width + 'px';
        chartCanvas.style.height = rect.height + 'px';

        chartCtx.setTransform(1, 0, 0, 1, 0, 0);
        chartCtx.scale(dpr, dpr);

        renderChart();
    }
}

// Get current history length (for debugging)
export function getHistoryCount() {
    return powerHistory.length;
}

// Check if history has been loaded from HA
export function isHistoryLoaded() {
    return historyLoaded;
}

// ============================================
// COST CALCULATIONS
// ============================================

// South African electricity tariffs (City Power Johannesburg 2024 rates)
const TARIFF_CONFIG = {
    peak: { rate: 3.50 },
    standard: { rate: 2.20 },
    offPeak: { rate: 1.20 },
    feedIn: 0.80
};

export function getTodaysCost(gridImportToday, gridExportToday) {
    // Simplified daily cost calculation using average weighted rate
    const avgRate = (TARIFF_CONFIG.peak.rate * 4 + TARIFF_CONFIG.standard.rate * 10 + TARIFF_CONFIG.offPeak.rate * 10) / 24;
    const importCost = gridImportToday * avgRate;
    const exportCredit = gridExportToday * TARIFF_CONFIG.feedIn;
    return importCost - exportCredit;
}
