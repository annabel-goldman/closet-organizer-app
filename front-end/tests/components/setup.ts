import "@testing-library/jest-dom/vitest";

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: () => "blob:test-image",
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: () => undefined,
});
