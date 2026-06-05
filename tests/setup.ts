import '@testing-library/jest-dom'

const testElementWidth = 800
const testElementHeight = 400

// Mock layout APIs used by responsive chart containers in jsdom.
global.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
    }

    observe(target: Element) {
        this.callback([
            {
                target,
                contentRect: {
                    x: 0,
                    y: 0,
                    top: 0,
                    left: 0,
                    bottom: testElementHeight,
                    right: testElementWidth,
                    width: testElementWidth,
                    height: testElementHeight,
                    toJSON: () => ({}),
                },
                borderBoxSize: [{ inlineSize: testElementWidth, blockSize: testElementHeight }],
                contentBoxSize: [{ inlineSize: testElementWidth, blockSize: testElementHeight }],
                devicePixelContentBoxSize: [{ inlineSize: testElementWidth, blockSize: testElementHeight }],
            } as ResizeObserverEntry,
        ], this)
    }

    unobserve() { }
    disconnect() { }
}

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
        return testElementWidth
    },
})

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
        return testElementHeight
    },
})

HTMLElement.prototype.getBoundingClientRect = function () {
    return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: testElementHeight,
        right: testElementWidth,
        width: testElementWidth,
        height: testElementHeight,
        toJSON: () => ({}),
    }
}
