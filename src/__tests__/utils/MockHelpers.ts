import * as notifier from 'node-notifier';
import { TestDataFactory } from '../integration/TestDataFactory';

/**
 * Standardized mock helpers for consistent test setup across all test files
 */
export class MockHelpers {
  /**
   * Setup file system mocks with common patterns
   */
  static setupFileSystemMocks() {
    const mockFs = {
      ensureDir: jest.fn().mockResolvedValue(undefined),
      pathExists: jest.fn().mockResolvedValue(true),
      readFile: jest.fn().mockResolvedValue('{}'),
      writeFile: jest.fn().mockResolvedValue(undefined),
      appendFile: jest.fn().mockResolvedValue(undefined),
      writeJson: jest.fn().mockResolvedValue(undefined),
      readJson: jest.fn().mockResolvedValue({}),
      readdir: jest.fn().mockResolvedValue([]),
      stat: jest.fn().mockResolvedValue({ mtime: new Date() } as any),
      access: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      copy: jest.fn().mockResolvedValue(undefined),
      move: jest.fn().mockResolvedValue(undefined)
    };

    return mockFs;
  }

  /**
   * Setup file system mocks with specific file structure
   */
  static setupFileSystemWithStructure(fileStructure: Record<string, string>) {
    const mockFs = MockHelpers.setupFileSystemMocks();
    
    mockFs.pathExists = jest.fn().mockImplementation((path: string) => {
      return Promise.resolve(Object.keys(fileStructure).includes(path));
    });
    
    mockFs.readFile = jest.fn().mockImplementation((path: string) => {
      const content = fileStructure[path];
      return content ? Promise.resolve(content) : Promise.reject(new Error('File not found'));
    });
    
    mockFs.readJson = jest.fn().mockImplementation((path: string) => {
      const content = fileStructure[path];
      return content ? Promise.resolve(JSON.parse(content)) : Promise.reject(new Error('File not found'));
    });

    return mockFs;
  }

  /**
   * Setup network/HTTP mocks for web scraping
   */
  static setupNetworkMocks() {
    const mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html><body>Mock content</body></html>'),
      title: jest.fn().mockResolvedValue('Mock Page Title'),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      select: jest.fn().mockResolvedValue([]),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf'))
    };

    const mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
      pages: jest.fn().mockResolvedValue([mockPage])
    };

    const mockPuppeteer = {
      launch: jest.fn().mockResolvedValue(mockBrowser as any)
    };

    return { mockPuppeteer, mockBrowser, mockPage };
  }

  /**
   * Setup notification mocks (desktop, audio, telegram)
   */
  static setupNotificationMocks() {
    // Mock node-notifier
    const mockNotifier = notifier as jest.Mocked<typeof notifier>;
    mockNotifier.notify = jest.fn().mockImplementation((_options, callback) => {
      if (callback) callback(null, 'success');
    });

    // Mock Telegram Bot
    const mockBotInstance = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
      getMe: jest.fn().mockResolvedValue({ id: 123, is_bot: true, first_name: 'TestBot' }),
      getChat: jest.fn().mockResolvedValue({ id: 'test-chat', type: 'private' })
    };
    
    const mockTelegramBot = jest.fn().mockImplementation(() => mockBotInstance);

    return { mockNotifier, mockTelegramBot, mockBotInstance };
  }

  /**
   * Setup console mocks to capture output during tests
   */
  static setupConsoleMocks() {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    const mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    // Replace console methods
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;

    return {
      mockConsole,
      restore: () => {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
      }
    };
  }

  /**
   * Setup process mocks for CLI testing
   */
  static setupProcessMocks() {
    const originalProcess = {
      exit: process.exit,
      argv: process.argv,
      env: process.env,
      cwd: process.cwd
    };

    const mockProcess = {
      exit: jest.fn(),
      argv: ['node', 'cli.js'],
      env: { ...process.env },
      cwd: jest.fn().mockReturnValue('/test/directory')
    };

    // Replace process methods
    process.exit = mockProcess.exit as any;
    process.argv = mockProcess.argv;
    process.env = mockProcess.env;
    process.cwd = mockProcess.cwd;

    return {
      mockProcess,
      restore: () => {
        process.exit = originalProcess.exit;
        process.argv = originalProcess.argv;
        process.env = originalProcess.env;
        process.cwd = originalProcess.cwd;
      }
    };
  }

  /**
   * Setup timer mocks for testing time-dependent functionality
   */
  static setupTimerMocks() {
    jest.useFakeTimers();
    
    const mockDate = new Date('2025-02-15T10:00:00Z');
    jest.setSystemTime(mockDate);

    return {
      mockDate,
      advanceTime: (ms: number) => jest.advanceTimersByTime(ms),
      restore: () => {
        jest.useRealTimers();
      }
    };
  }

  /**
   * Setup environment variable mocks
   */
  static setupEnvironmentMocks(envVars: Record<string, string> = {}) {
    const originalEnv = process.env;
    
    process.env = {
      ...originalEnv,
      ...envVars
    };

    return {
      restore: () => {
        process.env = originalEnv;
      }
    };
  }

  /**
   * Reset all mocks to their initial state
   */
  static resetAllMocks() {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  }

  /**
   * Create a complete mock setup for integration tests
   */
  static setupIntegrationTestMocks() {
    const fileStructure = TestDataFactory.createMockFileStructure();
    
    const mocks = {
      fs: MockHelpers.setupFileSystemWithStructure(fileStructure),
      network: MockHelpers.setupNetworkMocks(),
      notifications: MockHelpers.setupNotificationMocks(),
      console: MockHelpers.setupConsoleMocks(),
      process: MockHelpers.setupProcessMocks(),
      timers: MockHelpers.setupTimerMocks(),
      environment: MockHelpers.setupEnvironmentMocks({
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: 'test-chat-id'
      })
    };

    return {
      ...mocks,
      restoreAll: () => {
        mocks.console.restore();
        mocks.process.restore();
        mocks.timers.restore();
        mocks.environment.restore();
        MockHelpers.resetAllMocks();
      }
    };
  }

  /**
   * Create mock data for specific test scenarios
   */
  static createScenarioMocks(scenario: 'success' | 'error' | 'timeout' | 'partial-failure') {
    const mocks = MockHelpers.setupIntegrationTestMocks();

    switch (scenario) {
      case 'success':
        // All operations succeed
        break;
        
      case 'error':
        // File operations fail
        mocks.fs.readFile = jest.fn().mockRejectedValue(new Error('File read error'));
        mocks.fs.writeFile = jest.fn().mockRejectedValue(new Error('File write error'));
        break;
        
      case 'timeout':
        // Network operations timeout
        mocks.network.mockPage.goto = jest.fn().mockRejectedValue(new Error('Timeout'));
        break;
        
      case 'partial-failure':
        // Some operations fail, others succeed
        mocks.notifications.mockNotifier.notify = jest.fn().mockImplementation((_options, callback) => {
          if (callback) callback(new Error('Notification failed'), null);
        });
        break;
    }

    return mocks;
  }
}