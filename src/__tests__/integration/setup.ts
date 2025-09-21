/**
 * Setup file for integration tests
 */

// Increase timeout for integration tests
jest.setTimeout(60000);

// Mock external dependencies globally
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue('<html><body></body></html>'),
      close: jest.fn(),
      evaluate: jest.fn().mockResolvedValue([]),
      waitForSelector: jest.fn().mockResolvedValue(null),
      $: jest.fn().mockResolvedValue(null),
      $$: jest.fn().mockResolvedValue([])
    }),
    close: jest.fn()
  })
}));

jest.mock('node-notifier', () => ({
  notify: jest.fn((_options, callback) => {
    if (callback) callback(null);
  })
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  pathExists: jest.fn().mockResolvedValue(false),
  remove: jest.fn().mockResolvedValue(undefined),
  emptyDir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  unlink: jest.fn().mockResolvedValue(undefined),
  rmdir: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined)
}));

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
  
  // Remove event listeners
  process.removeListener('unhandledRejection', unhandledRejectionHandler);
  process.removeListener('uncaughtException', uncaughtExceptionHandler);
});

// Global test utilities
(global as any).testUtils = {
  // Add any global test utilities here
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Handle unhandled promise rejections in tests
process.setMaxListeners(20); // Increase limit to avoid warnings

const unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
  if (process.env.VERBOSE_TESTS) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
};

const uncaughtExceptionHandler = (error: Error) => {
  if (process.env.VERBOSE_TESTS) {
    console.error('Uncaught Exception:', error);
  }
};

process.on('unhandledRejection', unhandledRejectionHandler);
process.on('uncaughtException', uncaughtExceptionHandler);

// Clean up any hanging timers after tests
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});