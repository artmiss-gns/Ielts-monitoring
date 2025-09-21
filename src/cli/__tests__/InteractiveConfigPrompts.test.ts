import { InteractiveConfigPrompts } from '../InteractiveConfigPrompts';

// Mock readline
jest.mock('readline');

// Mock EnvironmentConfigManager
jest.mock('../../services/EnvironmentConfigManager', () => ({
  EnvironmentConfigManager: {
    validateTelegramEnvironment: jest.fn()
  }
}));

// Mock chalk to avoid console output during tests
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  red: jest.fn((text) => text)
}));

const { EnvironmentConfigManager } = require('../../services/EnvironmentConfigManager');

describe('InteractiveConfigPrompts', () => {
  let interactivePrompts: InteractiveConfigPrompts;
  let mockRl: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation();
    
    // Mock readline interface
    mockRl = {
      question: jest.fn(),
      close: jest.fn()
    };

    const readline = require('readline');
    readline.createInterface = jest.fn().mockReturnValue(mockRl);
    
    interactivePrompts = new InteractiveConfigPrompts();
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('InteractiveConfigPrompts', () => {
    it('should create InteractiveConfigPrompts instance', () => {
      // Basic test to ensure class can be instantiated
      expect(interactivePrompts).toBeInstanceOf(InteractiveConfigPrompts);
    });

    it('should have promptForConfiguration method', () => {
      expect(typeof interactivePrompts.promptForConfiguration).toBe('function');
    });

    it('should have confirmRestart method', () => {
      expect(typeof interactivePrompts.confirmRestart).toBe('function');
    });
  });

  describe('promptForNotificationSettings', () => {
    it('should include Telegram prompting in notification settings', async () => {
      // Mock all prompts to return specific values
      const mockPromptForBoolean = jest.spyOn(interactivePrompts as any, 'promptForBoolean');
      const mockPromptForTelegramNotifications = jest.spyOn(interactivePrompts as any, 'promptForTelegramNotifications');
      
      mockPromptForBoolean
        .mockResolvedValueOnce(true)  // desktop
        .mockResolvedValueOnce(false) // audio
        .mockResolvedValueOnce(true); // logFile
      
      mockPromptForTelegramNotifications.mockResolvedValue(true);

      const result = await (interactivePrompts as any).promptForNotificationSettings();

      expect(result).toEqual({
        desktop: true,
        audio: false,
        logFile: true,
        telegram: true
      });

      expect(mockPromptForTelegramNotifications).toHaveBeenCalledWith(undefined);
    });

    it('should pass current telegram setting to promptForTelegramNotifications', async () => {
      const mockPromptForBoolean = jest.spyOn(interactivePrompts as any, 'promptForBoolean');
      const mockPromptForTelegramNotifications = jest.spyOn(interactivePrompts as any, 'promptForTelegramNotifications');
      
      mockPromptForBoolean
        .mockResolvedValueOnce(true)  // desktop
        .mockResolvedValueOnce(false) // audio
        .mockResolvedValueOnce(true); // logFile
      
      mockPromptForTelegramNotifications.mockResolvedValue(false);

      const currentSettings = {
        desktop: false,
        audio: true,
        logFile: false,
        telegram: true
      };

      await (interactivePrompts as any).promptForNotificationSettings(currentSettings);

      expect(mockPromptForTelegramNotifications).toHaveBeenCalledWith(true);
    });

    it('should enable logFile when all notifications are disabled', async () => {
      const mockPromptForBoolean = jest.spyOn(interactivePrompts as any, 'promptForBoolean');
      const mockPromptForTelegramNotifications = jest.spyOn(interactivePrompts as any, 'promptForTelegramNotifications');
      
      // Mock all notifications as disabled
      mockPromptForBoolean
        .mockResolvedValueOnce(false) // desktop
        .mockResolvedValueOnce(false) // audio
        .mockResolvedValueOnce(false); // logFile
      
      mockPromptForTelegramNotifications.mockResolvedValue(false);

      const result = await (interactivePrompts as any).promptForNotificationSettings();

      expect(result).toEqual({
        desktop: false,
        audio: false,
        logFile: true, // Should be forced to true
        telegram: false
      });
    });
  });

  describe('promptForTelegramNotifications', () => {
    it('should default to true when Telegram credentials are available', async () => {
      // Mock Telegram credentials as available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      // Mock user pressing Enter (empty input, should use default)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('');
      });

      // Access the private method through reflection for testing
      const result = await (interactivePrompts as any).promptForTelegramNotifications();

      expect(result).toBe(true);
      expect(mockRl.question).toHaveBeenCalledWith(
        expect.stringContaining('Enable Telegram notifications [Y/n]:'),
        expect.any(Function)
      );
    });

    it('should default to false when Telegram credentials are not available', async () => {
      // Mock Telegram credentials as not available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      // Mock user pressing Enter (empty input, should use default)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('');
      });

      const result = await (interactivePrompts as any).promptForTelegramNotifications();

      expect(result).toBe(false);
      expect(mockRl.question).toHaveBeenCalledWith(
        expect.stringContaining('Enable Telegram notifications [y/N]:'),
        expect.any(Function)
      );
    });

    it('should use current setting as default when provided', async () => {
      // Mock Telegram credentials as not available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN']
      });

      // Mock user pressing Enter (empty input, should use provided current setting)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('');
      });

      // Test with current setting = true (should override credential-based default)
      const result = await (interactivePrompts as any).promptForTelegramNotifications(true);

      expect(result).toBe(true);
      expect(mockRl.question).toHaveBeenCalledWith(
        expect.stringContaining('Enable Telegram notifications [Y/n]:'),
        expect.any(Function)
      );
    });

    it('should accept user input to enable Telegram when credentials are missing', async () => {
      // Mock Telegram credentials as not available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      // Mock user typing 'y'
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('y');
      });

      const result = await (interactivePrompts as any).promptForTelegramNotifications();

      expect(result).toBe(true);
    });

    it('should accept user input to disable Telegram when credentials are available', async () => {
      // Mock Telegram credentials as available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      // Mock user typing 'n'
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('n');
      });

      const result = await (interactivePrompts as any).promptForTelegramNotifications();

      expect(result).toBe(false);
    });

    it('should display appropriate status messages based on credential availability', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Test with credentials available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('');
      });

      await (interactivePrompts as any).promptForTelegramNotifications();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Telegram credentials detected'));

      // Reset and test with credentials missing
      consoleSpy.mockClear();
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      await (interactivePrompts as any).promptForTelegramNotifications();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  Telegram credentials not configured'));
    });

    it('should show warning when enabling Telegram without credentials', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Mock Telegram credentials as not available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      // Mock user enabling Telegram despite missing credentials
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('y');
      });

      await (interactivePrompts as any).promptForTelegramNotifications();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  Telegram notifications enabled but credentials are missing'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('To configure Telegram:'));
    });

    it('should show success message when enabling Telegram with credentials', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Mock Telegram credentials as available
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      // Mock user confirming to enable Telegram
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback('y');
      });

      await (interactivePrompts as any).promptForTelegramNotifications();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Telegram notifications will be active'));
    });
  });
});