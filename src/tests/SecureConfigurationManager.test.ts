import { SecureConfigurationManager } from '../services/SecureConfigurationManager';
import * as fs from 'fs-extra';

describe('SecureConfigurationManager', () => {
  let configManager: SecureConfigurationManager;
  const testConfigPath = 'test-config.json';
  const testTelegramConfigPath = 'test-telegram-config.json';

  beforeEach(() => {
    configManager = new SecureConfigurationManager(testConfigPath, testTelegramConfigPath);
    // Clear environment variables
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.MONITOR_CHECK_INTERVAL;
  });

  afterEach(async () => {
    // Clean up test files
    if (await fs.pathExists(testConfigPath)) {
      await fs.remove(testConfigPath);
    }
    if (await fs.pathExists(testTelegramConfigPath)) {
      await fs.remove(testTelegramConfigPath);
    }
  });

  describe('loadSecureConfig', () => {
    it('should load default configuration when no files or env vars exist', async () => {
      const config = await configManager.loadSecureConfig();
      
      expect(config.city).toEqual(['isfahan']);
      expect(config.examModel).toEqual(['cdielts']);
      expect(config.months).toEqual([12, 1, 2]);
      expect(config.checkInterval).toBe(300000);
      expect(config.notificationSettings.telegram).toBe(false);
      expect(config.security?.enableSecureLogging).toBe(true);
      expect(config.server?.enableHealthCheck).toBe(false);
    });

    it('should override config with environment variables', async () => {
      process.env.MONITOR_CHECK_INTERVAL = '600000';
      process.env.MONITOR_CITIES = 'Tehran,Isfahan';
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const config = await configManager.loadSecureConfig();
      
      expect(config.checkInterval).toBe(600000);
      expect(config.city).toEqual(['Tehran', 'Isfahan']);
      expect(config.notificationSettings.telegram).toBe(true);
    });

    it('should validate configuration and throw error for invalid config', async () => {
      process.env.MONITOR_CHECK_INTERVAL = '1000'; // Too low, should be at least 5000

      await expect(configManager.loadSecureConfig()).rejects.toThrow('Invalid configuration');
    });
  });

  describe('loadTelegramConfig', () => {
    it('should return null when no Telegram config is available', async () => {
      const telegramConfig = await configManager.loadTelegramConfig();
      expect(telegramConfig).toBeNull();
    });

    it('should load Telegram config from environment variables', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const telegramConfig = await configManager.loadTelegramConfig();
      
      expect(telegramConfig).not.toBeNull();
      expect(telegramConfig?.botToken).toBe('test-bot-token');
      expect(telegramConfig?.chatId).toBe('test-chat-id');
      expect(telegramConfig?.messageFormat).toBe('detailed');
    });

    it('should load Telegram config from file when env vars not available', async () => {
      const testTelegramConfig = {
        botToken: 'file-bot-token',
        chatId: 'file-chat-id',
        messageFormat: 'simple',
        enablePreview: true
      };

      await fs.writeJson(testTelegramConfigPath, testTelegramConfig);

      const telegramConfig = await configManager.loadTelegramConfig();
      
      expect(telegramConfig).not.toBeNull();
      expect(telegramConfig?.botToken).toBe('file-bot-token');
      expect(telegramConfig?.chatId).toBe('file-chat-id');
      expect(telegramConfig?.messageFormat).toBe('simple');
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive fields in configuration', () => {
      const config = {
        botToken: '1234567890abcdef', // 16 chars
        chatId: 'chat123456', // 10 chars
        normalField: 'normal-value'
      };

      const masked = configManager.maskSensitiveData(config);
      
      // For 16 char string: first 2 + 12 stars + last 2 = '12************ef'
      expect(masked.botToken).toBe('12************ef');
      // For 10 char string: first 2 + 6 stars + last 2 = 'ch******56'
      expect(masked.chatId).toBe('ch******56');
      expect(masked.normalField).toBe('normal-value');
    });

    it('should handle short strings by masking completely', () => {
      const config = {
        botToken: 'abc',
        chatId: 'xy'
      };

      const masked = configManager.maskSensitiveData(config);
      
      expect(masked.botToken).toBe('***');
      expect(masked.chatId).toBe('**');
    });
  });

  describe('hasSensitiveData', () => {
    it('should detect sensitive data in configuration', () => {
      const configWithSensitive = {
        botToken: 'secret-token',
        normalField: 'normal'
      };

      const configWithoutSensitive = {
        city: 'Isfahan',
        checkInterval: 30000
      };

      expect(configManager.hasSensitiveData(configWithSensitive)).toBe(true);
      expect(configManager.hasSensitiveData(configWithoutSensitive)).toBe(false);
    });

    it('should detect nested sensitive data', () => {
      const config = {
        telegram: {
          botToken: 'secret-token'
        },
        normalField: 'normal'
      };

      expect(configManager.hasSensitiveData(config)).toBe(true);
    });
  });
});