/**
 * Indicator Atom
 * Connection and status indicators (dots, pulses)
 */

import { Atom } from '../utils/Component.js';

export class Indicator extends Atom {
    static tag = 'span';

    static styles() {
        return `
            .indicator {
                display: inline-block;
                border-radius: 50%;
                transition: all var(--transition-fast);
            }

            /* Sizes */
            .indicator--xs { width: 6px; height: 6px; }
            .indicator--sm { width: 8px; height: 8px; }
            .indicator--md { width: 10px; height: 10px; }
            .indicator--lg { width: 12px; height: 12px; }
            .indicator--xl { width: 16px; height: 16px; }

            /* Colors */
            .indicator--emerald {
                background: var(--color-emerald);
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
            }

            .indicator--red {
                background: var(--color-red);
                box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
            }

            .indicator--amber {
                background: var(--color-amber);
                box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
            }

            .indicator--blue {
                background: var(--color-blue);
                box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            }

            .indicator--purple {
                background: var(--color-purple);
                box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
            }

            .indicator--muted {
                background: var(--color-text-muted);
                box-shadow: none;
            }

            /* Pulse animation */
            .indicator--pulse {
                animation: pulse 2s ease-in-out infinite;
            }

            /* Ring variant */
            .indicator--ring {
                background: transparent;
                border: 2px solid currentColor;
                box-shadow: none;
            }

            .indicator--ring.indicator--emerald { border-color: var(--color-emerald); }
            .indicator--ring.indicator--red { border-color: var(--color-red); }
            .indicator--ring.indicator--amber { border-color: var(--color-amber); }
        `;
    }

    getClassName() {
        const {
            color = 'emerald',
            size = 'md',
            pulse = false,
            ring = false,
            className = ''
        } = this.props;

        const classes = ['indicator', `indicator--${color}`, `indicator--${size}`];

        if (pulse) classes.push('indicator--pulse');
        if (ring) classes.push('indicator--ring');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        return '';
    }
}

/**
 * Connection Indicator - specialized for connection status
 */
export class ConnectionIndicator extends Indicator {
    static styles() {
        return `
            ${Indicator.styles()}

            .connection-indicator {
                transition: all var(--transition-normal);
            }

            .connection-indicator--connected {
                background: var(--color-emerald);
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
            }

            .connection-indicator--disconnected {
                background: var(--color-red);
                box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
                animation: pulse 2s ease-in-out infinite;
            }

            .connection-indicator--connecting {
                background: var(--color-amber);
                box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
                animation: pulse 1s ease-in-out infinite;
            }
        `;
    }

    getClassName() {
        const { connected, connecting, size = 'md', className = '' } = this.props;

        let status = 'disconnected';
        if (connected) status = 'connected';
        else if (connecting) status = 'connecting';

        const classes = [
            'indicator',
            'connection-indicator',
            `indicator--${size}`,
            `connection-indicator--${status}`
        ];

        if (className) classes.push(className);

        return classes.join(' ');
    }
}

export default Indicator;
