/**
 * Dashboard Entry Point
 *
 * This file initializes the modular component system and
 * registers all components with the registry.
 */

// Component System
import { registry } from './utils/ComponentRegistry.js';
import { Component, Atom, Molecule, Organism, Template } from './utils/Component.js';

// Atoms
import Icon, { ICONS } from './atoms/Icon.js';
import Button from './atoms/Button.js';
import Badge from './atoms/Badge.js';
import Indicator, { ConnectionIndicator } from './atoms/Indicator.js';

// Molecules
import StatusPill from './molecules/StatusPill.js';
import LightControl from './molecules/LightControl.js';
import NavItem from './molecules/NavItem.js';
import WeatherBadge from './molecules/WeatherBadge.js';

// Organisms
import RoomCard from './organisms/RoomCard.js';
import StatusBar from './organisms/StatusBar.js';
import BottomNav from './organisms/BottomNav.js';

// Configuration
import dashboardConfig from './config/dashboard.config.js';

// Utilities
import * as helpers from './utils/helpers.js';

/**
 * Initialize the component system
 */
export function initComponents() {
    // Register all atoms
    registry.registerAll({
        Icon,
        Button,
        Badge,
        Indicator,
        ConnectionIndicator
    });

    // Register all molecules
    registry.registerAll({
        StatusPill,
        LightControl,
        NavItem,
        WeatherBadge
    });

    // Register all organisms
    registry.registerAll({
        RoomCard,
        StatusBar,
        BottomNav
    });

    console.log('[Components] Registered', registry.list().length, 'components');

    return registry;
}

/**
 * Create a component from configuration
 */
export function createFromConfig(config) {
    const { type, id, props = {} } = config;

    if (!registry.has(type)) {
        console.warn(`[Components] Unknown component type: ${type}`);
        return null;
    }

    const component = registry.create(type, { ...props, id });
    return component;
}

/**
 * Render a view from configuration
 */
export function renderView(viewConfig, container) {
    if (!viewConfig || !viewConfig.components) {
        console.warn('[Components] Invalid view configuration');
        return [];
    }

    const components = [];

    viewConfig.components.forEach(componentConfig => {
        const component = createFromConfig(componentConfig);
        if (component) {
            component.mount(container);
            components.push(component);
        }
    });

    return components;
}

// Export everything for external use
export {
    // Core
    registry,
    Component,
    Atom,
    Molecule,
    Organism,
    Template,

    // Atoms
    Icon,
    ICONS,
    Button,
    Badge,
    Indicator,
    ConnectionIndicator,

    // Molecules
    StatusPill,
    LightControl,
    NavItem,
    WeatherBadge,

    // Organisms
    RoomCard,
    StatusBar,
    BottomNav,

    // Config
    dashboardConfig,

    // Helpers
    helpers
};

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    window.DashboardComponents = {
        registry,
        initComponents,
        createFromConfig,
        renderView,
        helpers,
        config: dashboardConfig
    };
}
