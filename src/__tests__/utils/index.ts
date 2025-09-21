/**
 * Test utilities and helpers for consistent testing patterns
 */

import { TestDataFactory } from '../integration/TestDataFactory';
import { MockHelpers } from './MockHelpers';
import { CLITestFramework, CLITestUtils } from './CLITestFramework';
import { AssertionHelpers, customMatchers } from './AssertionHelpers';

// Re-export all utilities
export { TestDataFactory, MockHelpers, CLITestFramework, CLITestUtils, AssertionHelpers, customMatchers };

// Setup function to initialize all test utilities
export function setupTestEnvironment() {
  // Extend Jest with custom matchers
  expect.extend(customMatchers);
  
  // Setup global test configuration
  jest.setTimeout(10000); // 10 second timeout for integration tests
  
  // Mock console methods by default to reduce test noise
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });
}

// Common test patterns and utilities
export const TestPatterns = {
  /**
   * Standard setup for integration tests
   */
  integrationTestSetup: () => {
    const mockHelpers = MockHelpers.setupIntegrationTestMocks();
    const cliFramework = new CLITestFramework();
    
    beforeEach(() => {
      cliFramework.setup();
    });

    afterEach(() => {
      cliFramework.cleanup();
      MockHelpers.resetAllMocks();
    });

    return { mockHelpers, cliFramework };
  },

  /**
   * Standard setup for unit tests
   */
  unitTestSetup: () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });
  },

  /**
   * Standard setup for CLI tests
   */
  cliTestSetup: () => {
    const framework = new CLITestFramework();
    
    beforeEach(() => {
      framework.setup();
    });

    afterEach(() => {
      framework.cleanup();
    });

    return framework;
  }
};

// Export commonly used test data
export const CommonTestData = {
  get validAppointment() { return TestDataFactory.createAppointments(1)[0]; },
  get validConfig() { return TestDataFactory.createMonitorConfig(); },
  get validNotificationSettings() { return TestDataFactory.createNotificationSettings(); },
  get mockStatistics() { return TestDataFactory.createMockStatistics(); },
  get mockFileStructure() { return TestDataFactory.createMockFileStructure(); }
};