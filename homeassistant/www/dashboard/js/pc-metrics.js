/**
 * PC Metrics Dashboard Module
 * Futuristic system performance monitoring with real-time visualizations
 */

// ============================================
// CONFIGURATION
// ============================================

const PC_METRICS_API = 'http://192.168.x.x:8765/api/metrics';
const REFRESH_INTERVAL = 2000; // 2 seconds
const HISTORY_LENGTH = 180; // 6 minutes of history at 2s intervals

// ============================================
// STATE
// ============================================

let metricsInterval = null;
let cpuHistory = [];
let memoryHistory = [];
let networkHistory = { sent: [], recv: [] };
let lastNetworkStats = null;
let canvasContexts = {};
let tempGaugeChart = null;
let frigateTreemapChart = null;

// Frigate API (via CORS proxy)
const FRIGATE_API = 'http://192.168.x.x:5003';

// Camera display config - muted colors matching dark dashboard aesthetic (60% transparent)
const CAMERA_COLORS = {
    front_door: 'rgba(244, 63, 94, 0.15)',   // Rose - 60% transparent
    backyard: 'rgba(139, 92, 246, 0.15)',    // Purple - 60% transparent
    wyze_garage: 'rgba(6, 182, 212, 0.15)',  // Cyan - 60% transparent
    ezviz_indoor: 'rgba(251, 191, 36, 0.12)' // Amber - 60% transparent
};

const CAMERA_ACCENTS = {
    front_door: '#f43f5e',
    backyard: '#8b5cf6',
    wyze_garage: '#06b6d4',
    ezviz_indoor: '#fbbf24'
};

const CAMERA_NAMES = {
    front_door: 'Front Door',
    backyard: 'Backyard',
    wyze_garage: 'Garage',
    ezviz_indoor: 'Indoor'
};

// ============================================
// INITIALIZATION
// ============================================

export function initPCMetrics() {
    console.log('Initializing PC Metrics Dashboard...');
    setupCanvases();
    initTemperatureGauge();
    initFrigateTreemap();
}

function initTemperatureGauge() {
    const chartEl = document.getElementById('tempGaugeChart');
    if (!chartEl || typeof ApexCharts === 'undefined') return;

    const options = {
        series: [0],
        chart: {
            type: 'radialBar',
            height: 110,
            sparkline: { enabled: true },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                dynamicAnimation: { enabled: true, speed: 400 }
            }
        },
        plotOptions: {
            radialBar: {
                startAngle: -135,
                endAngle: 135,
                hollow: {
                    size: '55%',
                    background: 'transparent'
                },
                track: {
                    background: 'rgba(255,255,255,0.08)',
                    strokeWidth: '100%',
                    margin: 0,
                    dropShadow: { enabled: false }
                },
                dataLabels: {
                    name: { show: false },
                    value: {
                        offsetY: 5,
                        fontSize: '22px',
                        fontWeight: 300,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        color: '#fff',
                        formatter: (val) => Math.round(val) + '°'
                    }
                }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'horizontal',
                gradientToColors: ['#22c55e'],
                stops: [0, 100]
            }
        },
        colors: ['#06b6d4'],
        stroke: { lineCap: 'round' }
    };

    tempGaugeChart = new ApexCharts(chartEl, options);
    tempGaugeChart.render();
}

function initFrigateTreemap() {
    const chartEl = document.getElementById('frigateTreemap');
    if (!chartEl || typeof ApexCharts === 'undefined') return;

    const options = {
        series: [{
            data: []
        }],
        chart: {
            type: 'treemap',
            height: '100%',
            toolbar: { show: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 500
            },
            background: 'transparent'
        },
        legend: { show: false },
        dataLabels: {
            enabled: true,
            style: {
                fontSize: '11px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 500,
                colors: ['rgba(255,255,255,0.9)']
            },
            formatter: function(text, op) {
                return [text, op.value.toFixed(0) + '%'];
            },
            offsetY: -2,
            dropShadow: {
                enabled: true,
                top: 1,
                left: 0,
                blur: 2,
                opacity: 0.5
            }
        },
        plotOptions: {
            treemap: {
                distributed: true,
                enableShades: false,
                borderRadius: 8,
                useFillColorAsStroke: false
            }
        },
        colors: Object.values(CAMERA_COLORS),
        stroke: {
            width: 1,
            colors: ['rgba(255,255,255,0.08)']
        },
        tooltip: {
            enabled: true,
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const data = w.config.series[0].data[dataPointIndex];
                if (!data) return '';
                return `
                    <div style="background: rgba(10,10,15,0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; font-family: Inter, system-ui; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
                        <div style="font-weight: 600; color: ${data.accent}; margin-bottom: 6px; font-size: 13px;">${data.x}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.6;">
                            <div>Storage: <span style="color: rgba(255,255,255,0.9); font-weight: 500;">${(data.usage / 1024).toFixed(1)} GB</span></div>
                            <div>Bandwidth: <span style="color: rgba(255,255,255,0.9); font-weight: 500;">${data.bandwidth.toFixed(1)} MB/hr</span></div>
                            <div>Share: <span style="color: ${data.accent}; font-weight: 600;">${data.y.toFixed(1)}%</span></div>
                        </div>
                    </div>
                `;
            }
        },
        states: {
            hover: {
                filter: { type: 'lighten', value: 0.05 }
            },
            active: {
                filter: { type: 'none' }
            }
        }
    };

    frigateTreemapChart = new ApexCharts(chartEl, options);
    frigateTreemapChart.render();

    // Initial fetch
    fetchFrigateStorage();
}

async function fetchFrigateStorage() {
    // Skip if accessing externally (can't reach local Frigate API)
    const isExternal = window.location.hostname.includes('nabu.casa') ||
                       window.location.hostname.includes('ui.nabu');

    if (isExternal) {
        showFrigateExternalMessage();
        return;
    }

    try {
        const response = await fetch(`${FRIGATE_API}/api/recordings/storage`);
        if (!response.ok) throw new Error('Frigate API error');

        const data = await response.json();
        updateFrigateTreemap(data);
    } catch (error) {
        console.warn('Failed to fetch Frigate storage:', error);
        showFrigateExternalMessage();
    }
}

function showFrigateExternalMessage() {
    const chartEl = document.getElementById('frigateTreemap');
    const statsEl = document.getElementById('frigateStorageStats');
    const totalEl = document.getElementById('frigateStorageTotal');

    if (chartEl) {
        chartEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center opacity-60">
                <svg class="w-8 h-8 text-rose-400/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <div class="text-[10px] text-white/40">Local Network Only</div>
            </div>
        `;
    }
    if (statsEl) statsEl.innerHTML = '';
    if (totalEl) totalEl.textContent = '';
}

function updateFrigateTreemap(storageData) {
    if (!frigateTreemapChart) return;

    // Calculate total and build treemap data
    let totalUsageMB = 0;
    const treemapData = [];

    Object.entries(storageData).forEach(([camera, stats]) => {
        totalUsageMB += stats.usage;
        treemapData.push({
            x: CAMERA_NAMES[camera] || camera,
            y: stats.usage_percent,
            usage: stats.usage,
            bandwidth: stats.bandwidth,
            fillColor: CAMERA_COLORS[camera] || 'rgba(107, 114, 128, 0.35)',
            accent: CAMERA_ACCENTS[camera] || '#6b7280',
            camera: camera
        });
    });

    // Sort by usage (largest first)
    treemapData.sort((a, b) => b.y - a.y);

    // Update chart
    frigateTreemapChart.updateSeries([{ data: treemapData }]);

    // Update total display
    const totalEl = document.getElementById('frigateStorageTotal');
    if (totalEl) {
        const totalGB = (totalUsageMB / 1024).toFixed(1);
        totalEl.textContent = `${totalGB} GB`;
    }

    // Update mini stats at bottom with accent colors
    const statsEl = document.getElementById('frigateStorageStats');
    if (statsEl) {
        statsEl.innerHTML = treemapData.map(cam => `
            <div class="text-center">
                <div class="w-1.5 h-1.5 rounded-full mx-auto mb-1" style="background: ${cam.accent}; box-shadow: 0 0 8px ${cam.accent}60;"></div>
                <div class="text-[8px] text-white/30 truncate">${cam.x}</div>
                <div class="text-[9px] font-mono font-medium" style="color: ${cam.accent}90">${cam.y.toFixed(0)}%</div>
            </div>
        `).join('');
    }
}

export function startPCMetrics() {
    if (metricsInterval) return;

    // Initial fetch
    fetchAndUpdateMetrics();

    // Update Frigate detection toggle
    import('./views.js').then(views => {
        views.updateFrigateDetectionToggle();
    });

    // Start polling
    metricsInterval = setInterval(fetchAndUpdateMetrics, REFRESH_INTERVAL);
}

export function stopPCMetrics() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchAndUpdateMetrics() {
    try {
        const response = await fetch(PC_METRICS_API);
        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        updateDashboard(data);
        updateHeaderHealth(data.health);

    } catch (error) {
        console.warn('Failed to fetch PC metrics:', error);
        showOfflineState();
    }
}

// ============================================
// DASHBOARD UPDATES
// ============================================

function updateDashboard(data) {
    const { health, cpu, memory, disks, network, system, docker_containers, top_processes } = data;

    // Update health
    updateHealthScore(health);

    // Update system info
    updateSystemInfo(system);

    // Update CPU section
    updateCPU(cpu);

    // Update Memory section
    updateMemory(memory);

    // Update Disk section (system disk only)
    updateDisks(disks);

    // Update Frigate storage (separate API)
    fetchFrigateStorage();

    // Update Network section
    updateNetwork(network);

    // Update Process lists
    updateProcesses(top_processes);

    // Update Docker containers
    updateDocker(docker_containers);

    // Update charts
    updateCharts(cpu, memory, network);

    // Update timestamp
    const lastUpdate = document.getElementById('pcLastUpdate');
    if (lastUpdate) {
        lastUpdate.textContent = `LIVE DATA • ${new Date().toLocaleTimeString()}`;
    }
}

function updateHealthScore(health) {
    const scoreEl = document.getElementById('pcHealthScore');
    const gradeEl = document.getElementById('pcHealthGrade');
    const statusEl = document.getElementById('pcHealthStatus');
    const ringEl = document.getElementById('pcHealthRing');
    const issuesEl = document.getElementById('pcHealthIssues');

    if (scoreEl) scoreEl.textContent = health.score;
    if (gradeEl) {
        gradeEl.textContent = health.grade;
        gradeEl.className = `text-xl font-black ${getHealthColor(health.status)}`;
    }
    if (statusEl) {
        statusEl.textContent = health.status.toUpperCase();
        statusEl.className = `text-xs font-medium ${getHealthColor(health.status)}`;
    }

    // Update ring progress (circumference = 2 * PI * r = 2 * 3.14159 * 42 = 264)
    if (ringEl) {
        const circumference = 264;
        const offset = circumference - (health.score / 100) * circumference;
        ringEl.style.strokeDashoffset = offset;
        ringEl.style.stroke = getHealthStrokeColor(health.status);
    }

    // Update issues list
    if (issuesEl) {
        if (health.issues.length > 0) {
            issuesEl.innerHTML = health.issues.map(issue =>
                `<div class="flex items-center gap-2 text-xs text-red-400/80">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    ${issue}
                </div>`
            ).join('');
            issuesEl.classList.remove('hidden');
        } else {
            issuesEl.classList.add('hidden');
        }
    }
}

function updateSystemInfo(system) {
    const uptimeEl = document.getElementById('pcUptime');
    const hostnameEl = document.getElementById('pcHostname');
    const osEl = document.getElementById('pcOS');
    const processCountEl = document.getElementById('pcProcessCount');

    if (uptimeEl) uptimeEl.textContent = system.uptime_formatted;
    if (hostnameEl) hostnameEl.textContent = system.hostname;
    if (osEl) osEl.textContent = system.os;
    if (processCountEl) processCountEl.textContent = system.process_count;
}

function updateCPU(cpu) {
    // Main CPU usage
    const usageEl = document.getElementById('cpuUsage');
    const freqEl = document.getElementById('cpuFreq');
    const coresEl = document.getElementById('cpuCores');
    const loadEl = document.getElementById('cpuLoad');
    const barEl = document.getElementById('cpuBar');
    const statusEl = document.getElementById('cpuStatus');

    if (usageEl) usageEl.textContent = Math.round(cpu.usage_percent);
    if (freqEl) freqEl.textContent = `${(cpu.frequency_mhz.current / 1000).toFixed(2)} GHz`;
    if (coresEl) coresEl.textContent = `${cpu.cores} cores`;
    if (loadEl) loadEl.textContent = `Load: ${cpu.load_average['1min'].toFixed(2)}`;
    if (barEl) barEl.style.width = `${cpu.usage_percent}%`;

    // Status indicator
    if (statusEl) {
        statusEl.className = `pc-status-dot ${cpu.usage_percent > 80 ? 'critical' : cpu.usage_percent > 50 ? 'warning' : 'active'}`;
    }

    // Update per-core visualization
    updateCoreVisualization(cpu.per_core_percent);

    // Update temperature gauge
    const packageTemp = cpu.temperatures['Package id 0'] || cpu.temperatures['Composite'];
    if (packageTemp) {
        updateTemperatureGauge(packageTemp.current);
    }

    // Record history
    cpuHistory.push(cpu.usage_percent);
    if (cpuHistory.length > HISTORY_LENGTH) cpuHistory.shift();
}

function updateTemperatureGauge(temp) {
    if (!tempGaugeChart) return;

    const roundedTemp = Math.round(temp);

    // Determine color based on temperature
    let color, gradientTo, status;
    if (temp < 50) {
        color = '#06b6d4'; // Cyan
        gradientTo = '#22c55e'; // Green
        status = 'COOL';
    } else if (temp < 70) {
        color = '#fbbf24'; // Amber
        gradientTo = '#f97316'; // Orange
        status = 'WARM';
    } else if (temp < 85) {
        color = '#f97316'; // Orange
        gradientTo = '#ef4444'; // Red
        status = 'HOT';
    } else {
        color = '#ef4444'; // Red
        gradientTo = '#dc2626'; // Dark red
        status = 'CRITICAL';
    }

    // Update chart
    tempGaugeChart.updateOptions({
        colors: [color],
        fill: {
            gradient: {
                gradientToColors: [gradientTo]
            }
        }
    }, false, false);

    tempGaugeChart.updateSeries([roundedTemp]);

    // Update status text
    const statusEl = document.getElementById('tempStatus');
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = `text-[10px] font-medium ${
            status === 'COOL' ? 'text-cyan-400' :
            status === 'WARM' ? 'text-amber-400' :
            status === 'HOT' ? 'text-orange-400' : 'text-red-400'
        }`;
    }

    // Update card glow based on temperature
    const card = document.querySelector('.pc-card-temp');
    if (card) {
        const glowColor = status === 'COOL' ? 'rgba(6, 182, 212, 0.15)' :
                         status === 'WARM' ? 'rgba(251, 191, 36, 0.2)' :
                         status === 'HOT' ? 'rgba(249, 115, 22, 0.25)' : 'rgba(239, 68, 68, 0.3)';
        card.style.setProperty('--card-glow', glowColor);
    }
}

function updateCoreVisualization(perCore) {
    const container = document.getElementById('cpuCoreGrid');
    if (!container) return;

    container.innerHTML = perCore.map((percent, i) => `
        <div class="cpu-core-bar" title="Core ${i}: ${Math.round(percent)}%">
            <div class="cpu-core-fill ${percent > 80 ? 'critical' : percent > 50 ? 'warning' : ''}"
                 style="height: ${percent}%"></div>
            <span class="cpu-core-label">${i}</span>
        </div>
    `).join('');
}

function updateMemory(memory) {
    const usageEl = document.getElementById('memUsage');
    const usedEl = document.getElementById('memUsed');
    const totalEl = document.getElementById('memTotal');
    const cachedEl = document.getElementById('memCached');
    const swapEl = document.getElementById('memSwap');
    const barEl = document.getElementById('memBar');
    const statusEl = document.getElementById('memStatus');

    if (usageEl) usageEl.textContent = Math.round(memory.percent);
    if (usedEl) usedEl.textContent = `${memory.used_gb.toFixed(1)} GB`;
    if (totalEl) totalEl.textContent = `${memory.total_gb.toFixed(1)} GB`;
    if (cachedEl) cachedEl.textContent = `Cache: ${memory.cached_gb.toFixed(1)} GB`;
    if (swapEl) swapEl.textContent = `Swap: ${memory.swap.percent}%`;
    if (barEl) barEl.style.width = `${memory.percent}%`;

    if (statusEl) {
        statusEl.className = `pc-status-dot ${memory.percent > 85 ? 'critical' : memory.percent > 70 ? 'warning' : 'active'}`;
    }

    // Record history
    memoryHistory.push(memory.percent);
    if (memoryHistory.length > HISTORY_LENGTH) memoryHistory.shift();
}

function updateDisks(disks) {
    const container = document.getElementById('systemDiskCard');
    if (!container) return;

    // Only show root partition for system disk
    const systemDisk = disks.partitions.find(d => d.mountpoint === '/');
    if (!systemDisk) return;

    const disk = systemDisk;
    const statusClass = disk.percent > 90 ? 'critical' : disk.percent > 75 ? 'warning' : 'healthy';
    const usedColor = disk.percent > 90 ? '#ef4444' : disk.percent > 75 ? '#fbbf24' : '#06b6d4';
    const circumference = 339;
    const offset = circumference - (disk.percent / 100) * circumference;

    const totalFormatted = disk.total_gb >= 1000 ? (disk.total_gb/1000).toFixed(1) + ' TB' : disk.total_gb.toFixed(0) + ' GB';
    const usedFormatted = disk.used_gb >= 1000 ? (disk.used_gb/1000).toFixed(1) + ' TB' : disk.used_gb.toFixed(1) + ' GB';
    const freeFormatted = disk.free_gb >= 1000 ? (disk.free_gb/1000).toFixed(1) + ' TB' : disk.free_gb.toFixed(1) + ' GB';

    container.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
            </svg>
            <span class="text-[10px] text-white/60 uppercase tracking-wider">System</span>
            <span class="text-[10px] text-white/40 font-mono ml-auto">${totalFormatted}</span>
        </div>
        <div class="flex-1 flex items-center justify-center">
            <div class="relative">
                <svg class="w-20 h-20" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="${usedColor}"
                        stroke-width="8" stroke-linecap="round"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.5s ease; filter: drop-shadow(0 0 6px ${usedColor}40)"/>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-xl font-bold ${disk.percent > 90 ? 'text-red-400' : 'text-white'}">${Math.round(disk.percent)}%</span>
                    <span class="text-[8px] text-white/40 uppercase">Used</span>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
            <div class="text-center">
                <div class="text-[10px] font-semibold text-white/80 font-mono">${usedFormatted}</div>
                <div class="text-[8px] text-white/40">Used</div>
            </div>
            <div class="text-center">
                <div class="text-[10px] font-semibold text-emerald-400 font-mono">${freeFormatted}</div>
                <div class="text-[8px] text-white/40">Free</div>
            </div>
        </div>
    `;
}

function updateNetwork(network) {
    const sentEl = document.getElementById('netSent');
    const recvEl = document.getElementById('netRecv');
    const ifaceEl = document.getElementById('netInterface');

    if (sentEl) sentEl.textContent = `${network.bytes_sent_gb.toFixed(2)} GB`;
    if (recvEl) recvEl.textContent = `${network.bytes_recv_gb.toFixed(2)} GB`;

    // Show primary interface
    const primary = network.interfaces.find(i => i.is_up && i.ip && !i.ip.startsWith('127.'));
    if (ifaceEl && primary) {
        ifaceEl.textContent = `${primary.name}: ${primary.ip}`;
    }

    // Calculate speed if we have previous data
    if (lastNetworkStats) {
        const sentDelta = (network.bytes_sent_gb - lastNetworkStats.sent) * 1024; // MB
        const recvDelta = (network.bytes_recv_gb - lastNetworkStats.recv) * 1024;
        const intervalSec = REFRESH_INTERVAL / 1000;

        const sentSpeed = sentDelta / intervalSec;
        const recvSpeed = recvDelta / intervalSec;

        networkHistory.sent.push(sentSpeed);
        networkHistory.recv.push(recvSpeed);

        if (networkHistory.sent.length > HISTORY_LENGTH) {
            networkHistory.sent.shift();
            networkHistory.recv.shift();
        }

        // Update speed displays
        const sentSpeedEl = document.getElementById('netSentSpeed');
        const recvSpeedEl = document.getElementById('netRecvSpeed');
        if (sentSpeedEl) sentSpeedEl.textContent = formatSpeed(sentSpeed);
        if (recvSpeedEl) recvSpeedEl.textContent = formatSpeed(recvSpeed);
    }

    lastNetworkStats = { sent: network.bytes_sent_gb, recv: network.bytes_recv_gb };
}

function updateProcesses(processes) {
    updateProcessList('processCpuList', processes.by_cpu, 'cpu');
    updateProcessList('processMemList', processes.by_memory, 'memory');
}

function updateProcessList(containerId, processes, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = processes.map((proc, i) => {
        const value = type === 'cpu' ? proc.cpu_percent : proc.memory_percent;
        const barColor = value > 50 ? 'bg-red-500' : value > 25 ? 'bg-amber-500' : 'bg-cyan-500';

        return `
            <div class="process-row">
                <div class="process-rank">${i + 1}</div>
                <div class="process-info">
                    <div class="process-name">${proc.name}</div>
                    <div class="process-meta">PID: ${proc.pid}</div>
                </div>
                <div class="process-bar-container">
                    <div class="process-bar ${barColor}" style="width: ${Math.min(value * 2, 100)}%"></div>
                </div>
                <div class="process-value">${value.toFixed(1)}%</div>
            </div>
        `;
    }).join('');
}

function updateDocker(containers) {
    const container = document.getElementById('dockerGrid');
    const countEl = document.getElementById('dockerCount');

    if (countEl) countEl.textContent = containers.length;
    if (!container) return;

    // Sort by CPU usage
    const sorted = [...containers].sort((a, b) => b.cpu_percent - a.cpu_percent);

    container.innerHTML = sorted.slice(0, 8).map(c => {
        const statusClass = c.cpu_percent > 50 ? 'high' : c.cpu_percent > 20 ? 'medium' : 'low';
        return `
            <div class="docker-container-card ${statusClass}">
                <div class="docker-name">${c.name}</div>
                <div class="docker-stats">
                    <span class="docker-cpu" title="CPU">${c.cpu_percent.toFixed(1)}%</span>
                    <span class="docker-mem" title="Memory">${c.memory_percent.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CHART UPDATES
// ============================================

function setupCanvases() {
    const cpuCanvas = document.getElementById('cpuChart');
    const memCanvas = document.getElementById('memChart');
    const netCanvas = document.getElementById('netChart');

    if (cpuCanvas) canvasContexts.cpu = cpuCanvas.getContext('2d');
    if (memCanvas) canvasContexts.mem = memCanvas.getContext('2d');
    if (netCanvas) canvasContexts.net = netCanvas.getContext('2d');
}

function updateCharts(cpu, memory, network) {
    drawAreaChart('cpuChart', cpuHistory, '#06b6d4', 100);
    drawAreaChart('memChart', memoryHistory, '#a855f7', 100);
    drawDualAreaChart('netChart', networkHistory.recv, networkHistory.sent, '#22c55e', '#3b82f6');
}

function drawAreaChart(canvasId, data, color, maxValue) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 5, bottom: 5, left: 0, right: 0 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '00');

    // Draw area
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);

    data.forEach((value, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
        ctx.lineTo(x, y);
    });

    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    data.forEach((value, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawDualAreaChart(canvasId, data1, data2, color1, color2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data1.length < 2) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 5, bottom: 5 };
    const chartWidth = width;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Find max value for scaling
    const maxValue = Math.max(...data1, ...data2, 0.1);

    // Draw both lines
    [{ data: data1, color: color1 }, { data: data2, color: color2 }].forEach(({ data, color }) => {
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
        gradient.addColorStop(0, color + '30');
        gradient.addColorStop(1, color + '00');

        ctx.beginPath();
        ctx.moveTo(0, height - padding.bottom);

        data.forEach((value, i) => {
            const x = (i / (data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            ctx.lineTo(x, y);
        });

        ctx.lineTo(chartWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        data.forEach((value, i) => {
            const x = (i / (data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
}

// ============================================
// HEADER HEALTH INDICATOR
// ============================================

export function updateHeaderHealth(health) {
    const badge = document.getElementById('pcHealthBadge');
    const scoreText = document.getElementById('pcHealthBadgeScore');
    const statusDot = document.getElementById('pcHealthDot');

    if (!badge) return;

    if (scoreText) scoreText.textContent = `${health.score}%`;

    if (statusDot) {
        statusDot.className = `w-2 h-2 rounded-full ${
            health.status === 'healthy' ? 'bg-emerald-500 shadow-emerald-500/50' :
            health.status === 'warning' ? 'bg-amber-500 shadow-amber-500/50 animate-pulse' :
            'bg-red-500 shadow-red-500/50 animate-pulse'
        } shadow-lg`;
    }

    // Update badge styling based on status
    const iconContainer = badge.querySelector('.pc-icon-container');
    if (iconContainer) {
        iconContainer.className = `pc-icon-container w-10 h-10 rounded-xl flex items-center justify-center ${
            health.status === 'healthy' ? 'bg-emerald-500/20' :
            health.status === 'warning' ? 'bg-amber-500/20' :
            'bg-red-500/20'
        }`;
    }
}

function showOfflineState() {
    const badge = document.getElementById('pcHealthBadge');
    const scoreText = document.getElementById('pcHealthBadgeScore');

    if (scoreText) scoreText.textContent = 'OFFLINE';
    if (badge) {
        const dot = badge.querySelector('#pcHealthDot');
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-gray-500';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getHealthColor(status) {
    switch (status) {
        case 'healthy': return 'text-emerald-400';
        case 'warning': return 'text-amber-400';
        case 'critical': return 'text-red-400';
        default: return 'text-white/60';
    }
}

function getHealthStrokeColor(status) {
    switch (status) {
        case 'healthy': return '#22c55e';
        case 'warning': return '#fbbf24';
        case 'critical': return '#ef4444';
        default: return '#666';
    }
}

function getDiskIcon(type) {
    switch (type) {
        case 'ssd':
            return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
        case 'usb':
            return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';
        default:
            return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>';
    }
}

function getDiskLabel(mountpoint) {
    if (mountpoint === '/') return 'System';
    if (mountpoint === '/home') return 'Home';
    if (mountpoint.includes('frigate')) return 'Frigate Recordings';
    return mountpoint.split('/').pop() || mountpoint;
}

function formatSpeed(mbPerSec) {
    if (mbPerSec >= 1) return `${mbPerSec.toFixed(1)} MB/s`;
    return `${(mbPerSec * 1024).toFixed(0)} KB/s`;
}

// ============================================
// EXPORTS
// ============================================

export default {
    init: initPCMetrics,
    start: startPCMetrics,
    stop: stopPCMetrics
};
