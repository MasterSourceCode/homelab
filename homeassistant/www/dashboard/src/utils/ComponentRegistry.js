/**
 * Component Registry
 * Central registry for all UI components
 *
 * Provides:
 * - Component registration and lookup
 * - Factory methods for creating components
 * - CSS style aggregation
 * - Hot module replacement support
 */

class ComponentRegistry {
    constructor() {
        this.components = new Map();
        this.styles = new Map();
        this.instances = new Map();
        this.styleElement = null;
    }

    /**
     * Register a component class
     * @param {string} name - Component name (e.g., 'StatusPill', 'RoomCard')
     * @param {typeof Component} ComponentClass - The component class
     */
    register(name, ComponentClass) {
        if (this.components.has(name)) {
            console.warn(`[Registry] Component "${name}" is being re-registered`);
        }

        this.components.set(name, ComponentClass);

        // Collect component styles
        if (typeof ComponentClass.styles === 'function') {
            const styles = ComponentClass.styles();
            if (styles) {
                this.styles.set(name, styles);
                this.updateStyles();
            }
        }

        return this;
    }

    /**
     * Register multiple components at once
     * @param {Object} components - Object mapping names to component classes
     */
    registerAll(components) {
        Object.entries(components).forEach(([name, ComponentClass]) => {
            this.register(name, ComponentClass);
        });
        return this;
    }

    /**
     * Get a registered component class
     * @param {string} name - Component name
     * @returns {typeof Component | undefined}
     */
    get(name) {
        return this.components.get(name);
    }

    /**
     * Check if a component is registered
     * @param {string} name - Component name
     * @returns {boolean}
     */
    has(name) {
        return this.components.has(name);
    }

    /**
     * Create a new component instance
     * @param {string} name - Component name
     * @param {Object} props - Component props
     * @returns {Component | null}
     */
    create(name, props = {}) {
        const ComponentClass = this.components.get(name);

        if (!ComponentClass) {
            console.error(`[Registry] Component "${name}" not found`);
            return null;
        }

        const instance = new ComponentClass(props);
        return instance;
    }

    /**
     * Create and mount a component
     * @param {string} name - Component name
     * @param {Object} props - Component props
     * @param {Element|string} parent - Parent element or selector
     * @returns {Component | null}
     */
    mount(name, props, parent) {
        const instance = this.create(name, props);
        if (instance) {
            instance.mount(parent);
        }
        return instance;
    }

    /**
     * Get all registered component names
     * @returns {string[]}
     */
    list() {
        return Array.from(this.components.keys());
    }

    /**
     * Get components by type (atom, molecule, organism)
     * @param {string} type - Component type
     * @returns {Map<string, typeof Component>}
     */
    getByType(type) {
        const filtered = new Map();
        this.components.forEach((ComponentClass, name) => {
            if (ComponentClass.type === type) {
                filtered.set(name, ComponentClass);
            }
        });
        return filtered;
    }

    /**
     * Update the aggregated stylesheet
     */
    updateStyles() {
        if (!this.styleElement) {
            this.styleElement = document.createElement('style');
            this.styleElement.id = 'component-styles';
            document.head.appendChild(this.styleElement);
        }

        const allStyles = Array.from(this.styles.values()).join('\n\n');
        this.styleElement.textContent = allStyles;
    }

    /**
     * Get all component styles as a single string
     * @returns {string}
     */
    getAllStyles() {
        return Array.from(this.styles.values()).join('\n\n');
    }

    /**
     * Unregister a component
     * @param {string} name - Component name
     */
    unregister(name) {
        this.components.delete(name);
        this.styles.delete(name);
        this.updateStyles();
        return this;
    }

    /**
     * Clear all registered components
     */
    clear() {
        this.components.clear();
        this.styles.clear();
        this.instances.clear();
        this.updateStyles();
        return this;
    }

    /**
     * Debug: List all components with their types
     */
    debug() {
        console.group('[Component Registry]');
        console.log('Registered components:', this.components.size);

        const byType = {
            atom: [],
            molecule: [],
            organism: [],
            template: [],
            other: []
        };

        this.components.forEach((ComponentClass, name) => {
            const type = ComponentClass.type || 'other';
            (byType[type] || byType.other).push(name);
        });

        Object.entries(byType).forEach(([type, names]) => {
            if (names.length > 0) {
                console.log(`${type}s:`, names);
            }
        });

        console.groupEnd();
    }
}

// Export singleton instance
export const registry = new ComponentRegistry();

// Export class for testing
export { ComponentRegistry };

export default registry;
