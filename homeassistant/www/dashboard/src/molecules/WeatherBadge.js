/**
 * WeatherBadge Molecule
 * Compact weather display for header
 */

import { Molecule } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

// Weather condition to icon mapping
const WEATHER_ICONS = {
    'clear-night': 'moon',
    'cloudy': 'cloud',
    'fog': 'cloud',
    'hail': 'cloud',
    'lightning': 'power',
    'lightning-rainy': 'power',
    'partlycloudy': 'sun',
    'pouring': 'cloud',
    'rainy': 'cloud',
    'snowy': 'cloud',
    'snowy-rainy': 'cloud',
    'sunny': 'sun',
    'windy': 'cloud',
    'windy-variant': 'cloud',
    'exceptional': 'warning'
};

export class WeatherBadge extends Molecule {
    static styles() {
        return `
            .weather-badge {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                padding: var(--spacing-xs) var(--spacing-md);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                cursor: pointer;
                transition: all var(--transition-fast);
            }

            .weather-badge:active {
                transform: scale(0.95);
                background: var(--glass-bg-hover);
            }

            .weather-badge__icon {
                width: 18px;
                height: 18px;
                color: var(--color-amber);
            }

            .weather-badge__temp {
                font-size: var(--text-base);
                font-weight: var(--font-semibold);
                color: var(--color-text-primary);
            }

            /* Weather condition colors */
            .weather-badge--sunny .weather-badge__icon { color: var(--color-amber); }
            .weather-badge--cloudy .weather-badge__icon { color: var(--color-text-tertiary); }
            .weather-badge--rainy .weather-badge__icon { color: var(--color-blue); }
            .weather-badge--stormy .weather-badge__icon { color: var(--color-purple); }
            .weather-badge--night .weather-badge__icon { color: var(--color-cyan); }
        `;
    }

    getClassName() {
        const { condition = 'sunny', className = '' } = this.props;

        let conditionClass = 'sunny';
        if (condition.includes('cloud') || condition.includes('fog')) conditionClass = 'cloudy';
        if (condition.includes('rain') || condition.includes('pour')) conditionClass = 'rainy';
        if (condition.includes('lightning')) conditionClass = 'stormy';
        if (condition.includes('night')) conditionClass = 'night';

        const classes = ['weather-badge', `weather-badge--${conditionClass}`];
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const { temperature, condition = 'sunny' } = this.props;
        const iconName = WEATHER_ICONS[condition] || 'sun';
        const iconPath = ICONS[iconName] || ICONS.sun;

        const tempDisplay = temperature !== undefined ? `${Math.round(temperature)}°` : '--°';

        return `
            <svg class="weather-badge__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${iconPath}
            </svg>
            <span class="weather-badge__temp">${tempDisplay}</span>
        `;
    }

    onMount() {
        const { onClick } = this.props;

        if (onClick) {
            this.on(this.element, 'click', onClick);
        }
    }
}

export default WeatherBadge;
