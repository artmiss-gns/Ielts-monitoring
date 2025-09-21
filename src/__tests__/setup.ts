/**
 * Jest setup file for test infrastructure
 * This file is automatically loaded before running tests
 */

import { setupTestEnvironment, customMatchers } from './utils';

// Setup test environment
setupTestEnvironment();

// Extend Jest with custom matchers
expect.extend(customMatchers);

// Global test configuration
jest.setTimeout(10000); // 10 second timeout for integration tests

// Mock external dependencies that should never be called during tests
jest.mock('node-notifier', () => ({
  notify: jest.fn((_options, callback) => {
    if (callback) callback(null, 'success');
  })
}));

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
    getMe: jest.fn().mockResolvedValue({ id: 123, is_bot: true, first_name: 'TestBot' }),
    getChat: jest.fn().mockResolvedValue({ id: 'test-chat', type: 'private' })
  }));
});

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html><body>Mock content</body></html>'),
      title: jest.fn().mockResolvedValue('Mock Page Title'),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined)
    }),
    close: jest.fn().mockResolvedValue(undefined)
  })
}));

// Suppress console output during tests unless explicitly needed
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Only suppress if not in debug mode
if (!process.env.DEBUG_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
}

// Global cleanup
afterAll(() => {
  if (!process.env.DEBUG_TESTS) {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Global error handler for tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process during tests
});