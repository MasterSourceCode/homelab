/**
 * StatusBar Organism
 * Header status bar with quick stats
 */

import { Organism } from '../utils/Component.js';
import StatusPill from '../molecules/StatusPill.js';
import WeatherBadge from '../molecules/WeatherBadge.js';
import { ConnectionIndicator } from '../atoms/Indicator.js';

export class StatusBar extends Organism {
    static styles() {
        return `
            .status-bar {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
            }

            .status-bar__top {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .status-bar__time-wrapper {
                display: flex;
                flex-direction: column;
            }

            .status-bar__time {
                font-size: var(--text-4xl);
                font-weight: var(--font-bold);
                letter-spacing: -0.02em;
                background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .status-bar__date {
                font-size: var(--text-sm);
                color: var(--color-text-tertiary);
                font-weight: var(--font-medium);
            }

            .status-bar__right {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }

            .status-bar__pills {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: var(--spacing-sm);
            }
        `;
    }

    constructor(props) {
        super(props);
        this.state = {
            time: this.formatTime(),
            date: this.formatDate()
        };
        this.timeInterval = null;
    }

    formatTime() {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    formatDate() {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    template() {
        const { time, date } = this.state;
        const {
            temperature,
            weatherCondition,
            connected = false,
            lightsOn = 0,
            alarmState = 'disarmed',
            power = 0,
            showPills = true
        } = this.props;

        const pillsHtml = showPills ? `
            <div class="status-bar__pills">
                <div class="status-pill status-pill--lights ${lightsOn > 0 ? 'status-pill--active' : ''}"
                     data-action="showAllLights">
                    <svg class="status-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    <span class="status-pill__value">${lightsOn}</span>
                    <span class="status-pill__label">Lights</span>
                </div>
                <div class="status-pill status-pill--security ${alarmState !== 'disarmed' ? 'status-pill--armed' : 'status-pill--disarmed'}"
                     data-action="showSecurity">
                    <svg class="status-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    <span class="status-pill__value">${alarmState === 'disarmed' ? 'Off' : 'On'}</span>
                    <span class="status-pill__label">Alarm</span>
                </div>
                <div class="status-pill status-pill--power" data-action="showEnergy">
                    <svg class="status-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <span class="status-pill__value">${this.formatPower(power)}</span>
                    <span class="status-pill__label">Power</span>
                </div>
                <div class="status-pill status-pill--temperature" data-action="showWeather">
                    <svg class="status-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                    <span class="status-pill__value">${temperature !== undefined ? Math.round(temperature) + '°' : '--'}</span>
                    <span class="status-pill__label">Outside</span>
                </div>
            </div>
        ` : '';

        return `
            <div class="status-bar__top">
                <div class="status-bar__time-wrapper">
                    <div class="status-bar__time">${time}</div>
                    <div class="status-bar__date">${date}</div>
                </div>
                <div class="status-bar__right">
                    <div class="weather-badge" data-action="showWeather">
                        <svg class="weather-badge__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--color-amber)">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                        <span class="weather-badge__temp">${temperature !== undefined ? Math.round(temperature) + '°' : '--°'}</span>
                    </div>
                    <span class="indicator indicator--md ${connected ? 'indicator--emerald' : 'indicator--red indicator--pulse'}"></span>
                </div>
            </div>
            ${pillsHtml}
        `;
    }

    formatPower(watts) {
        if (watts === null || watts === undefined) return '--';
        if (Math.abs(watts) >= 1000) {
            return `${(watts / 1000).toFixed(1)}k`;
        }
        return `${Math.round(watts)}`;
    }

    onMount() {
        // Update time every minute
        this.timeInterval = setInterval(() => {
            this.setState({
                time: this.formatTime(),
                date: this.formatDate()
            });
        }, 60000);

        // Set up pill click handlers
        this.$$('[data-action]').forEach(el => {
            this.on(el, 'click', (e) => {
                const action = el.dataset.action;
                this.emit('status-action', { action });
            });
        });
    }

    onUnmount() {
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
        }
    }
}

export default StatusBar;
