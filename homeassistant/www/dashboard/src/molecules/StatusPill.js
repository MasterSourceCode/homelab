/**
 * StatusPill Molecule
 * Displays status information with icon, value, and label
 */

import { Molecule } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

export class StatusPill extends Molecule {
    static styles() {
        return `
            .status-pill {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--spacing-xs);
                padding: var(--spacing-md) var(--spacing-sm);
                background: var(--glass-bg);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-lg);
                transition: all var(--transition-fast);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }

            .status-pill:active {
                transform: scale(0.95);
                background: var(--glass-bg-hover);
            }

            .status-pill__icon {
                width: 22px;
                height: 22px;
                color: var(--pill-color, var(--color-text-secondary));
            }

            .status-pill__value {
                font-size: var(--text-lg);
                font-weight: var(--font-bold);
                line-height: 1;
                color: var(--pill-color, var(--color-text-primary));
            }

            .status-pill__label {
                font-size: var(--text-xs);
                color: var(--color-text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* Active states with glow */
            .status-pill--active {
                animation: glowPulse 3s ease-in-out infinite;
            }

            .status-pill--lights {
                --pill-color: var(--color-amber);
            }

            .status-pill--lights.status-pill--active {
                background: rgba(245, 158, 11, 0.1);
                border-color: rgba(245, 158, 11, 0.3);
                box-shadow: var(--glow-amber);
            }

            .status-pill--security {
                --pill-color: var(--color-red);
            }

            .status-pill--security.status-pill--armed {
                background: rgba(239, 68, 68, 0.1);
                border-color: rgba(239, 68, 68, 0.3);
                box-shadow: var(--glow-red);
            }

            .status-pill--security.status-pill--disarmed {
                --pill-color: var(--color-emerald);
                background: rgba(16, 185, 129, 0.1);
                border-color: rgba(16, 185, 129, 0.3);
            }

            .status-pill--power {
                --pill-color: var(--color-cyan);
            }

            .status-pill--temperature {
                --pill-color: var(--color-blue);
            }

            /* Hover spotlight effect */
            .status-pill::before {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(
                    circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                    rgba(255, 255, 255, 0.1) 0%,
                    transparent 50%
                );
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }

            .status-pill:hover::before,
            .status-pill:active::before {
                opacity: 1;
            }
        `;
    }

    getClassName() {
        const { type = 'default', active = false, armed = false, className = '' } = this.props;

        const classes = ['status-pill', `status-pill--${type}`];

        if (active) classes.push('status-pill--active');
        if (armed !== undefined) {
            classes.push(armed ? 'status-pill--armed' : 'status-pill--disarmed');
        }
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const { icon, value, label } = this.props;
        const iconPath = ICONS[icon] || ICONS.info;

        return `
            <svg class="status-pill__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${iconPath}
            </svg>
            <span class="status-pill__value">${value ?? '--'}</span>
            <span class="status-pill__label">${label || ''}</span>
        `;
    }

    onMount() {
        const { onClick, entityId, action } = this.props;

        if (onClick) {
            this.on(this.element, 'click', onClick);
        }

        // Set up data attributes for event delegation
        if (entityId) {
            this.element.setAttribute('data-entity-id', entityId);
        }
        if (action) {
            this.element.setAttribute('data-action', action);
        }
    }
}

export default StatusPill;
