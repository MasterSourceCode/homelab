/**
 * NavItem Molecule
 * Bottom navigation item with icon and label
 */

import { Molecule } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

export class NavItem extends Molecule {
    static tag = 'button';

    static styles() {
        return `
            .nav-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--spacing-xs);
                padding: var(--spacing-sm) 2px;
                color: var(--color-text-tertiary);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                background: transparent;
                border: none;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .nav-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%) scaleX(0);
                width: 24px;
                height: 3px;
                background: var(--color-cyan);
                border-radius: 0 0 3px 3px;
                transition: transform var(--transition-normal);
            }

            .nav-item--active {
                color: var(--color-cyan);
            }

            .nav-item--active::before {
                transform: translateX(-50%) scaleX(1);
            }

            .nav-item__icon {
                width: 20px;
                height: 20px;
                transition: transform var(--transition-fast);
            }

            .nav-item:active .nav-item__icon {
                transform: scale(0.9);
            }

            .nav-item__label {
                font-size: 0.5625rem;
                font-weight: var(--font-medium);
                text-transform: uppercase;
                letter-spacing: 0.02em;
            }

            /* Badge for notifications */
            .nav-item__badge {
                position: absolute;
                top: 4px;
                right: 50%;
                transform: translateX(12px);
                min-width: 14px;
                height: 14px;
                padding: 0 4px;
                background: var(--color-red);
                border-radius: var(--radius-full);
                font-size: 0.5rem;
                font-weight: var(--font-bold);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        `;
    }

    getClassName() {
        const { active = false, className = '' } = this.props;

        const classes = ['nav-item'];

        if (active) classes.push('nav-item--active');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const { icon, label, badge } = this.props;
        const iconPath = ICONS[icon] || ICONS.home;

        const badgeHtml = badge ? `<span class="nav-item__badge">${badge}</span>` : '';

        return `
            <svg class="nav-item__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${iconPath}
            </svg>
            <span class="nav-item__label">${label}</span>
            ${badgeHtml}
        `;
    }

    onMount() {
        const { view, onClick } = this.props;

        this.on(this.element, 'click', (e) => {
            if (onClick) {
                onClick(view);
            }
            this.emit('navigate', { view });
        });

        if (view) {
            this.element.setAttribute('data-view', view);
        }
    }
}

export default NavItem;
