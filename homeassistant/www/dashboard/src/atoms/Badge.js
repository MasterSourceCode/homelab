/**
 * Badge Atom
 * Status indicator badges with color variants
 */

import { Atom } from '../utils/Component.js';

export class Badge extends Atom {
    static tag = 'span';

    static styles() {
        return `
            .badge {
                display: inline-flex;
                align-items: center;
                gap: var(--spacing-xs);
                padding: 2px 8px;
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-semibold);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                line-height: 1.4;
            }

            /* Color variants */
            .badge--default {
                background: var(--glass-bg);
                color: var(--color-text-secondary);
            }

            .badge--amber {
                background: rgba(245, 158, 11, 0.2);
                color: var(--color-amber);
            }

            .badge--emerald {
                background: rgba(16, 185, 129, 0.2);
                color: var(--color-emerald);
            }

            .badge--red {
                background: rgba(239, 68, 68, 0.2);
                color: var(--color-red);
            }

            .badge--blue {
                background: rgba(59, 130, 246, 0.2);
                color: var(--color-blue);
            }

            .badge--purple {
                background: rgba(168, 85, 247, 0.2);
                color: var(--color-purple);
            }

            .badge--cyan {
                background: rgba(34, 211, 238, 0.2);
                color: var(--color-cyan);
            }

            .badge--pink {
                background: rgba(236, 72, 153, 0.2);
                color: var(--color-pink);
            }

            /* Size variants */
            .badge--sm {
                padding: 1px 6px;
                font-size: 0.625rem;
            }

            .badge--lg {
                padding: 4px 12px;
                font-size: var(--text-sm);
            }

            /* Pill variant */
            .badge--pill {
                border-radius: var(--radius-full);
                padding: 2px 10px;
            }

            /* Dot indicator */
            .badge__dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
            }

            .badge--pulse .badge__dot {
                animation: pulseDot 2s ease-in-out infinite;
            }
        `;
    }

    getClassName() {
        const {
            color = 'default',
            size = 'md',
            pill = false,
            pulse = false,
            className = ''
        } = this.props;

        const classes = ['badge', `badge--${color}`];

        if (size !== 'md') classes.push(`badge--${size}`);
        if (pill) classes.push('badge--pill');
        if (pulse) classes.push('badge--pulse');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const { text, dot = false } = this.props;

        const dotHtml = dot ? '<span class="badge__dot"></span>' : '';

        return `${dotHtml}${text || ''}`;
    }
}

export default Badge;
