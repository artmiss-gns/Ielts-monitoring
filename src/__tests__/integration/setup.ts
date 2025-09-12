/**
 * Setup file for integration tests
 */

// Increase timeout for integration tests
jest.setTimeout(60000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Only show console output if VERBOSE_TESTS environment variable is set
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
(global as any).testUtils = {
  // Add any global test utilities here
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up any hanging timers after tests
afterEach(() => {
  jest.clearAllTimers();
});