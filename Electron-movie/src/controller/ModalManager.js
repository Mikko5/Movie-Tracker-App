/**
 * ModalManager - Centralized stack-based modal management
 * 
 * Handles modal navigation with a stack approach:
 * - push() opens a modal and adds it to the stack
 * - pop() closes the top modal and reveals the previous one
 * - ESC key simply pops the stack
 */

// Modal stack - stores names of open modals in order
const modalStack = [];

// Registered modals with their open/close functions
const registeredModals = new Map();

/**
 * Register a modal with its open/close handlers
 * @param {string} name - Unique identifier for the modal
 * @param {Object} handlers - { open, close, isVisible } functions
 */
export const register = (name, handlers) => {
    if (!handlers.open || !handlers.close) {
        console.error(`ModalManager: Modal "${name}" must have open and close handlers`);
        return;
    }
    registeredModals.set(name, handlers);
};

/**
 * Open a modal and push it to the stack
 * @param {string} name - Name of the registered modal
 * @param {*} data - Optional data to pass to the open function
 */
export const push = (name, data) => {
    const modal = registeredModals.get(name);
    if (!modal) {
        console.error(`ModalManager: Modal "${name}" not registered`);
        return;
    }

    modalStack.push(name);
    modal.open(data);
};

/**
 * Close the top modal and remove from stack
 * @returns {boolean} Whether a modal was closed
 */
export const pop = () => {
    if (modalStack.length === 0) {
        return false;
    }

    const name = modalStack.pop();
    const modal = registeredModals.get(name);
    if (modal) {
        modal.close();
    }
    return true;
};

/**
 * Close all modals and clear the stack
 */
export const closeAll = () => {
    while (modalStack.length > 0) {
        pop();
    }
};

/**
 * Handle escape key - closes topmost modal
 * @returns {boolean} Whether a modal was closed
 */
export const handleEscape = () => {
    return pop();
};

/**
 * Get the currently active (top) modal name
 * @returns {string|null} Name of top modal or null if none
 */
export const getActiveModal = () => {
    return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
};

/**
 * Check if a specific modal is in the stack
 * @param {string} name - Modal name to check
 * @returns {boolean}
 */
export const isOpen = (name) => {
    return modalStack.includes(name);
};

/**
 * Check if any modal is open
 * @returns {boolean}
 */
export const hasOpenModals = () => {
    return modalStack.length > 0;
};

/**
 * Get the current stack depth
 * @returns {number}
 */
export const getStackDepth = () => {
    return modalStack.length;
};
