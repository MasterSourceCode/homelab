/**
 * BottomNav Organism
 * Bottom navigation bar
 */

import { Organism } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

export class BottomNav extends Organism {
    static tag = 'nav';

    static styles() {
        return `
            .bottom-nav {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: var(--z-fixed);
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                padding: var(--spacing-sm) 0;
                padding-bottom: calc(var(--spacing-sm) + var(--safe-bottom));
                background: linear-gradient(
                    to top,
                    rgba(10, 10, 15, 0.98) 0%,
                    rgba(10, 10, 15, 0.95) 60%,
                    rgba(10, 10, 15, 0.8) 100%
                );
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-top: 1px solid var(--glass-border);
            }

            .bottom-nav__item {
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

            .bottom-nav__item::before {
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

            .bottom-nav__item--active {
                color: var(--color-cyan);
            }

            .bottom-nav__item--active::before {
                transform: translateX(-50%) scaleX(1);
            }

            .bottom-nav__icon {
                width: 20px;
                height: 20px;
                transition: transform var(--transition-fast);
            }

            .bottom-nav__item:active .bottom-nav__icon {
                transform: scale(0.9);
            }

            .bottom-nav__label {
                font-size: 0.5625rem;
                font-weight: var(--font-medium);
                text-transform: uppercase;
                letter-spacing: 0.02em;
            }

            /* Badge for notifications */
            .bottom-nav__badge {
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

    constructor(props) {
        super(props);
        this.state = {
            activeView: props.activeView || 'home'
        };
    }

    getClassName() {
        return 'bottom-nav';
    }

    template() {
        const { items = [] } = this.props;
        const { activeView } = this.state;

        const defaultItems = [
            { id: 'home', icon: 'home', label: 'Home' },
            { id: 'cameras', icon: 'camera', label: 'Cams' },
            { id: 'calendar', icon: 'calendar', label: 'Calendar' },
            { id: 'security', icon: 'shield', label: 'Secure' },
            { id: 'more', icon: 'menu', label: 'More' }
        ];

        const navItems = items.length > 0 ? items : defaultItems;

        return navItems.map(item => {
            const isActive = item.id === activeView;
            const iconPath = ICONS[item.icon] || ICONS.home;
            const badgeHtml = item.badge ? `<span class="bottom-nav__badge">${item.badge}</span>` : '';

            return `
                <button class="bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}"
                        data-view="${item.id}"
                        id="nav-${item.id}">
                    <svg class="bottom-nav__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${iconPath}
                    </svg>
                    <span class="bottom-nav__label">${item.label}</span>
                    ${badgeHtml}
                </button>
            `;
        }).join('');
    }

    onMount() {
        const { onNavigate } = this.props;

        this.$$('.bottom-nav__item').forEach(item => {
            this.on(item, 'click', (e) => {
                const view = item.dataset.view;
                this.setActiveView(view);
                if (onNavigate) onNavigate(view);
                this.emit('navigate', { view });
            });
        });
    }

    setActiveView(view) {
        this.setState({ activeView: view });
    }
}

export default BottomNav;
