/**
 * RoomCard Organism
 * Room control card with lights summary and quick actions
 */

import { Organism } from '../utils/Component.js';
import { ICONS } from '../atoms/Icon.js';

export class RoomCard extends Organism {
    static styles() {
        return `
            .room-card {
                position: relative;
                padding: var(--spacing-lg);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-xl);
                overflow: hidden;
                transition: all var(--transition-fast);
                cursor: pointer;
            }

            .room-card:active {
                transform: scale(0.98);
            }

            .room-card--active {
                background: rgba(245, 158, 11, 0.08);
                border-color: rgba(245, 158, 11, 0.25);
            }

            /* Background image (optional) */
            .room-card__bg {
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
                opacity: 0.15;
                pointer-events: none;
            }

            .room-card__content {
                position: relative;
                z-index: 1;
            }

            .room-card__header {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-md);
            }

            .room-card__icon {
                width: 44px;
                height: 44px;
                border-radius: var(--radius-md);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-tertiary);
                flex-shrink: 0;
            }

            .room-card--active .room-card__icon {
                background: rgba(245, 158, 11, 0.15);
                border-color: rgba(245, 158, 11, 0.3);
                color: var(--color-amber);
                box-shadow: var(--glow-amber);
            }

            .room-card__icon svg {
                width: 22px;
                height: 22px;
            }

            .room-card__info {
                flex: 1;
                min-width: 0;
            }

            .room-card__name {
                font-size: var(--text-lg);
                font-weight: var(--font-semibold);
                color: var(--color-text-primary);
                margin-bottom: 2px;
            }

            .room-card__status {
                font-size: var(--text-sm);
                color: var(--color-text-tertiary);
            }

            .room-card--active .room-card__status {
                color: var(--color-amber);
            }

            /* Quick actions */
            .room-card__actions {
                display: flex;
                gap: var(--spacing-sm);
                margin-top: var(--spacing-md);
                padding-top: var(--spacing-md);
                border-top: 1px solid var(--glass-border);
            }

            .room-card__action {
                flex: 1;
                padding: var(--spacing-sm);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--spacing-xs);
                font-size: var(--text-sm);
                color: var(--color-text-secondary);
                transition: all var(--transition-fast);
            }

            .room-card__action:active {
                transform: scale(0.95);
                background: var(--glass-bg-hover);
            }

            .room-card__action svg {
                width: 16px;
                height: 16px;
            }

            /* Scene buttons */
            .room-card__scenes {
                display: flex;
                gap: var(--spacing-sm);
                margin-top: var(--spacing-sm);
            }

            .room-card__scene {
                padding: var(--spacing-xs) var(--spacing-md);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
                color: var(--color-text-tertiary);
                transition: all var(--transition-fast);
            }

            .room-card__scene:active {
                background: var(--glass-bg-hover);
            }

            .room-card__scene--active {
                background: rgba(168, 85, 247, 0.15);
                border-color: rgba(168, 85, 247, 0.3);
                color: var(--color-purple);
            }
        `;
    }

    constructor(props) {
        super(props);
        this.state = {
            lightsOn: props.lightsOn || 0,
            totalLights: props.totalLights || 0
        };
    }

    getClassName() {
        const { className = '' } = this.props;
        const { lightsOn } = this.state;

        const classes = ['room-card'];
        if (lightsOn > 0) classes.push('room-card--active');
        if (className) classes.push(className);

        return classes.join(' ');
    }

    template() {
        const {
            name,
            icon = 'home',
            backgroundImage,
            showActions = true,
            scenes = []
        } = this.props;
        const { lightsOn, totalLights } = this.state;

        const iconPath = ICONS[icon] || ICONS.home;
        const statusText = lightsOn > 0
            ? `${lightsOn} light${lightsOn > 1 ? 's' : ''} on`
            : 'All off';

        const bgStyle = backgroundImage
            ? `style="background-image: url('${backgroundImage}')"`
            : '';

        const actionsHtml = showActions ? `
            <div class="room-card__actions">
                <button class="room-card__action" data-action="all-on">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${ICONS.lightbulb}
                    </svg>
                    All On
                </button>
                <button class="room-card__action" data-action="all-off">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${ICONS.close}
                    </svg>
                    All Off
                </button>
            </div>
        ` : '';

        const scenesHtml = scenes.length > 0 ? `
            <div class="room-card__scenes">
                ${scenes.map(scene => `
                    <button class="room-card__scene ${scene.active ? 'room-card__scene--active' : ''}"
                            data-scene="${scene.id}">
                        ${scene.name}
                    </button>
                `).join('')}
            </div>
        ` : '';

        return `
            ${backgroundImage ? `<div class="room-card__bg" ${bgStyle}></div>` : ''}
            <div class="room-card__content">
                <div class="room-card__header">
                    <div class="room-card__icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${iconPath}
                        </svg>
                    </div>
                    <div class="room-card__info">
                        <div class="room-card__name">${name}</div>
                        <div class="room-card__status">${statusText}</div>
                    </div>
                </div>
                ${actionsHtml}
                ${scenesHtml}
            </div>
        `;
    }

    onMount() {
        const { roomId, onClick, onAllOn, onAllOff, onSceneActivate } = this.props;

        // Main card click
        this.on(this.element, 'click', (e) => {
            // Ignore if clicking on actions
            if (e.target.closest('.room-card__action') || e.target.closest('.room-card__scene')) {
                return;
            }
            if (onClick) onClick(roomId);
            this.emit('room-select', { roomId });
        });

        // Action buttons
        this.$$('.room-card__action').forEach(btn => {
            this.on(btn, 'click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'all-on' && onAllOn) onAllOn(roomId);
                if (action === 'all-off' && onAllOff) onAllOff(roomId);
                this.emit('room-action', { roomId, action });
            });
        });

        // Scene buttons
        this.$$('.room-card__scene').forEach(btn => {
            this.on(btn, 'click', (e) => {
                e.stopPropagation();
                const sceneId = btn.dataset.scene;
                if (onSceneActivate) onSceneActivate(sceneId);
                this.emit('scene-activate', { roomId, sceneId });
            });
        });

        if (roomId) {
            this.element.setAttribute('data-room-id', roomId);
        }
    }

    /**
     * Update the light count
     */
    updateLights(lightsOn, totalLights) {
        this.setState({ lightsOn, totalLights });
    }
}

export default RoomCard;
