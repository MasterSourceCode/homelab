/**
 * Base Component Class
 * Foundation for all UI components (Atoms, Molecules, Organisms)
 *
 * Provides:
 * - Template rendering with data binding
 * - Event handling with automatic cleanup
 * - State management with reactive updates
 * - CSS scoping
 * - Lifecycle hooks
 */

export class Component {
    static type = 'component';
    static tag = 'div';

    constructor(props = {}) {
        this.props = props;
        this.state = {};
        this.element = null;
        this.eventHandlers = [];
        this.subscriptions = [];
        this._mounted = false;
    }

    /**
     * Returns the component's CSS as a string
     * Override in subclasses to provide component-specific styles
     */
    static styles() {
        return '';
    }

    /**
     * Returns the component's HTML template
     * Override in subclasses
     */
    template() {
        return '';
    }

    /**
     * Lifecycle: Called after component is mounted to DOM
     */
    onMount() {}

    /**
     * Lifecycle: Called before component is removed from DOM
     */
    onUnmount() {}

    /**
     * Lifecycle: Called when component state or props change
     */
    onUpdate(prevState, prevProps) {}

    /**
     * Update component state and trigger re-render
     */
    setState(newState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.onUpdate(prevState, this.props);
        if (this._mounted) {
            this.render();
        }
    }

    /**
     * Update component props and trigger re-render
     */
    setProps(newProps) {
        const prevProps = { ...this.props };
        this.props = { ...this.props, ...newProps };
        this.onUpdate(this.state, prevProps);
        if (this._mounted) {
            this.render();
        }
    }

    /**
     * Add event listener with automatic cleanup tracking
     */
    on(element, event, handler, options = {}) {
        const el = typeof element === 'string' ? this.element?.querySelector(element) : element;
        if (el) {
            el.addEventListener(event, handler, options);
            this.eventHandlers.push({ element: el, event, handler, options });
        }
        return this;
    }

    /**
     * Subscribe to external events (e.g., state changes)
     */
    subscribe(emitter, event, handler) {
        if (emitter && typeof emitter.on === 'function') {
            emitter.on(event, handler);
            this.subscriptions.push({ emitter, event, handler });
        }
        return this;
    }

    /**
     * Render the component and return the element
     */
    render() {
        const html = this.template();

        if (!this.element) {
            this.element = document.createElement(this.constructor.tag || 'div');
            this.element.className = this.getClassName();
            this.element.setAttribute('data-component', this.constructor.name);
        }

        this.element.innerHTML = html;
        return this.element;
    }

    /**
     * Get the component's class name
     */
    getClassName() {
        const baseClass = this.constructor.name.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
        const propsClass = this.props.className || '';
        return `${baseClass} ${propsClass}`.trim();
    }

    /**
     * Mount the component to a parent element
     */
    mount(parent) {
        if (typeof parent === 'string') {
            parent = document.querySelector(parent);
        }

        if (!parent) {
            console.error(`[Component] Cannot mount ${this.constructor.name}: parent not found`);
            return this;
        }

        this.render();
        parent.appendChild(this.element);
        this._mounted = true;
        this.onMount();
        return this;
    }

    /**
     * Remove component from DOM and cleanup
     */
    unmount() {
        this.onUnmount();

        // Remove event listeners
        this.eventHandlers.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.eventHandlers = [];

        // Unsubscribe from external events
        this.subscriptions.forEach(({ emitter, event, handler }) => {
            if (typeof emitter.off === 'function') {
                emitter.off(event, handler);
            }
        });
        this.subscriptions = [];

        // Remove from DOM
        if (this.element?.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this._mounted = false;
        return this;
    }

    /**
     * Query a child element
     */
    $(selector) {
        return this.element?.querySelector(selector);
    }

    /**
     * Query all matching child elements
     */
    $$(selector) {
        return this.element?.querySelectorAll(selector) || [];
    }

    /**
     * Emit a custom event from this component
     */
    emit(eventName, detail = {}) {
        if (this.element) {
            this.element.dispatchEvent(new CustomEvent(eventName, {
                bubbles: true,
                composed: true,
                detail
            }));
        }
        return this;
    }

    /**
     * Create HTML from template literal with automatic escaping
     */
    html(strings, ...values) {
        return strings.reduce((result, string, i) => {
            let value = values[i] ?? '';
            // Don't escape if it's already HTML (marked with __html)
            if (value && typeof value === 'object' && value.__html) {
                value = value.__html;
            } else if (typeof value === 'string') {
                value = this.escape(value);
            }
            return result + string + value;
        }, '');
    }

    /**
     * Mark HTML as safe (no escaping)
     */
    safe(html) {
        return { __html: html };
    }

    /**
     * Escape HTML special characters
     */
    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Conditional rendering helper
     */
    when(condition, trueTemplate, falseTemplate = '') {
        return condition ? trueTemplate : falseTemplate;
    }

    /**
     * Loop rendering helper
     */
    each(items, template) {
        if (!Array.isArray(items)) return '';
        return items.map((item, index) => template(item, index)).join('');
    }
}

/**
 * Atom: Smallest UI element (button, icon, badge)
 * Should be stateless when possible
 */
export class Atom extends Component {
    static type = 'atom';
}

/**
 * Molecule: Combination of atoms (status pill, light control)
 * May have local state
 */
export class Molecule extends Component {
    static type = 'molecule';
}

/**
 * Organism: Complex component made of molecules and atoms
 * Has state and business logic
 */
export class Organism extends Component {
    static type = 'organism';
}

/**
 * Template: A full view/page template
 * Composes organisms into a complete view
 */
export class Template extends Component {
    static type = 'template';
}

export default Component;
