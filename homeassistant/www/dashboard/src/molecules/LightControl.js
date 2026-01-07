/**
 * LightControl Molecule
 * Individual light toggle with optional brightness slider
 */

import { Molecule } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

export class LightControl extends Molecule {
    static styles() {
        return `
            .light-control {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                padding: var(--spacing-md);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                transition: all var(--transition-fast);
                cursor: pointer;
            }

            .light-control:active {
                transform: scale(0.98);
            }

            .light-control--on {
                background: rgba(245, 158, 11, 0.1);
                border-color: rgba(245, 158, 11, 0.3);
            }

            .light-control__icon {
                width: 36px;
                height: 36px;
                border-radius: var(--radius-sm);
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--color-bg-tertiary);
                flex-shrink: 0;
            }

            .light-control--on .light-control__icon {
                background: rgba(245, 158, 11, 0.2);
                color: var(--color-amber);
                box-shadow: var(--glow-amber);
            }

            .light-control__icon svg {
                width: 20px;
                height: 20px;
            }

            .light-control__info {
                flex: 1;
                min-width: 0;
            }

            .light-control__name {
                font-size: var(--text-base);
                font-weight: var(--font-medium);
                color: var(--color-text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .light-control__state {
                font-size: var(--text-sm);
                color: var(--color-text-tertiary);
            }

            .light-control--on .light-control__state {
                color: var(--color-amber);
            }

            .light-control__toggle {
                width: 44px;
                height: 24px;
                border-radius: var(--radius-full);
                background: var(--color-bg-tertiary);
                position: relative;
                transition: all var(--transition-fast);
                flex-shrink: 0;
            }

            .light-control--on .light-control__toggle {
                background: var(--color-amber);
            }

            .light-control__toggle::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                transition: transform var(--transition-fast);
            }

            .light-control--on .light-control__toggle::after {
                transform: translateX(20px);
            }

            /* Brightness slider variant */
            .light-control--slider {
                flex-direction: column;
                align-items: stretch;
            }

            .light-control__slider-row {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }

            .light-control__brightness {
                margin-top: var(--spacing-sm);
                height: 4px;
                background: var(--color-bg-tertiary);
                border-radius: var(--radius-full);
                overflow: hidden;
            }

            .light-control__brightness-fill {
                height: 100%;
                background: var(--color-amber);
                transition: width var(--transition-fast);
            }
        `;
    }

    getClassName() {
        const { isOn = false, showSlider = false, className = '' } = this.props;

        const classes = ['light-control'];

        if (isOn) classes.push('light-control--on');
        if (showSlider) classes.push('light-control--slider');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const {
            name,
            isOn = false,
            brightness = 100,
            showSlider = false
        } = this.props;

        const stateText = isOn ? `${brightness}%` : 'Off';
        const brightnessBar = showSlider && isOn ? `
            <div class="light-control__brightness">
                <div class="light-control__brightness-fill" style="width: ${brightness}%"></div>
            </div>
        ` : '';

        return `
            <div class="light-control__slider-row">
                <div class="light-control__icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${ICONS.lightbulb}
                    </svg>
                </div>
                <div class="light-control__info">
                    <div class="light-control__name">${name}</div>
                    <div class="light-control__state">${stateText}</div>
                </div>
                <div class="light-control__toggle"></div>
            </div>
            ${brightnessBar}
        `;
    }

    onMount() {
        const { entityId, onToggle } = this.props;

        this.on(this.element, 'click', (e) => {
            if (onToggle) {
                onToggle(entityId);
            }
            this.emit('toggle', { entityId });
        });

        if (entityId) {
            this.element.setAttribute('data-entity-id', entityId);
        }
    }
}

export default LightControl;
