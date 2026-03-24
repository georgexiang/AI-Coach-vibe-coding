import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for Radix UI components (Slider, etc.)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill Element.scrollIntoView for jsdom
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}
