/**
 * Button Atom
 * Reusable button component with variants
 */

import { Atom } from '../utils/Component.js';
import { ICONS } from './Icon.js';

export class Button extends Atom {
    static tag = 'button';

    static styles() {
        return `
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--spacing-sm);
                font-weight: var(--font-semibold);
                border-radius: var(--btn-radius);
                transition: all var(--transition-fast);
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .btn:active {
                transform: scale(0.95);
            }

            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            /* Sizes */
            .btn--sm {
                height: var(--btn-height-sm);
                padding: 0 var(--spacing-md);
                font-size: var(--text-sm);
            }

            .btn--md {
                height: var(--btn-height-md);
                padding: 0 var(--spacing-lg);
                font-size: var(--text-base);
            }

            .btn--lg {
                height: var(--btn-height-lg);
                padding: 0 var(--spacing-xl);
                font-size: var(--text-lg);
            }

            /* Variants */
            .btn--primary {
                background: linear-gradient(135deg, var(--color-purple), var(--color-blue));
                color: white;
            }

            .btn--primary:hover {
                filter: brightness(1.1);
            }

            .btn--secondary {
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
            }

            .btn--secondary:hover {
                background: var(--glass-bg-hover);
                border-color: var(--glass-border-hover);
            }

            .btn--danger {
                background: linear-gradient(135deg, #f43f5e, var(--color-red));
                color: white;
            }

            .btn--success {
                background: linear-gradient(135deg, var(--color-emerald), var(--color-teal));
                color: white;
            }

            .btn--warning {
                background: linear-gradient(135deg, var(--color-amber), var(--color-orange));
                color: white;
            }

            .btn--ghost {
                background: transparent;
                color: var(--color-text-secondary);
            }

            .btn--ghost:hover {
                background: var(--glass-bg);
            }

            /* Icon only */
            .btn--icon {
                padding: 0;
                width: var(--btn-height-md);
            }

            .btn--icon.btn--sm { width: var(--btn-height-sm); }
            .btn--icon.btn--lg { width: var(--btn-height-lg); }

            /* Full width */
            .btn--block {
                width: 100%;
            }

            /* Glow effects */
            .btn--glow-amber { box-shadow: var(--glow-amber); }
            .btn--glow-emerald { box-shadow: var(--glow-emerald); }
            .btn--glow-red { box-shadow: var(--glow-red); }
            .btn--glow-purple { box-shadow: var(--glow-purple); }

            /* Button icon */
            .btn__icon {
                width: 18px;
                height: 18px;
                flex-shrink: 0;
            }

            .btn--sm .btn__icon { width: 14px; height: 14px; }
            .btn--lg .btn__icon { width: 22px; height: 22px; }

            /* Loading state */
            .btn--loading {
                pointer-events: none;
            }

            .btn--loading .btn__text {
                opacity: 0;
            }

            .btn__spinner {
                position: absolute;
                width: 18px;
                height: 18px;
                border: 2px solid transparent;
                border-top-color: currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
        `;
    }

    getClassName() {
        const {
            variant = 'primary',
            size = 'md',
            block = false,
            iconOnly = false,
            glow = null,
            loading = false,
            className = ''
        } = this.props;

        const classes = ['btn', `btn--${variant}`, `btn--${size}`];

        if (block) classes.push('btn--block');
        if (iconOnly) classes.push('btn--icon');
        if (glow) classes.push(`btn--glow-${glow}`);
        if (loading) classes.push('btn--loading');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const { icon, iconRight, text, loading = false } = this.props;

        let iconHtml = '';
        let iconRightHtml = '';

        if (icon && ICONS[icon]) {
            iconHtml = `
                <svg class="btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${ICONS[icon]}
                </svg>
            `;
        }

        if (iconRight && ICONS[iconRight]) {
            iconRightHtml = `
                <svg class="btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${ICONS[iconRight]}
                </svg>
            `;
        }

        const spinnerHtml = loading ? '<span class="btn__spinner"></span>' : '';
        const textHtml = text ? `<span class="btn__text">${text}</span>` : '';

        return `${iconHtml}${textHtml}${iconRightHtml}${spinnerHtml}`;
    }

    onMount() {
        const { onClick, disabled } = this.props;

        if (disabled) {
            this.element.disabled = true;
        }

        if (onClick && typeof onClick === 'function') {
            this.on(this.element, 'click', onClick);
        }
    }
}

export default Button;
