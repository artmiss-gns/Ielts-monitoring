import { EnvironmentConfigManager } from '../EnvironmentConfigManager';

describe('EnvironmentConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadEnvironmentConfig', () => {
    it('should load all environment variables', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.MONITOR_CHECK_INTERVAL = '300000';
      process.env.MONITOR_CITIES = 'Tehran,Isfahan';
      process.env.MONITOR_EXAM_MODELS = 'Academic,General';
      process.env.MONITOR_MONTHS = '1,2,3';
      process.env.MONITOR_BASE_URL = 'https://test.com';
      process.env.MONITOR_LOG_LEVEL = 'debug';
      process.env.ENABLE_SECURE_LOGGING = 'true';
      process.env.MASK_SENSITIVE_DATA = 'false';
      process.env.HEALTH_CHECK_PORT = '3001';
      process.env.ENABLE_METRICS = 'true';

      const config = EnvironmentConfigManager.loadEnvironmentConfig();

      expect(config).toEqual({
        telegramBotToken: 'test-token',
        telegramChatId: 'test-chat-id',
        monitorCheckInterval: 300000,
        monitorCities: ['Tehran', 'Isfahan'],
        monitorExamModels: ['Academic', 'General'],
        monitorMonths: [1, 2, 3],
        monitorBaseUrl: 'https://test.com',
        logLevel: 'debug',
        enableSecureLogging: true,
        maskSensitiveData: false,
        healthCheckPort: 3001,
        enableMetrics: true
      });
    });

    it('should handle missing environment variables', () => {
      const config = EnvironmentConfigManager.loadEnvironmentConfig();

      expect(config.telegramBotToken).toBeUndefined();
      expect(config.telegramChatId).toBeUndefined();
      expect(config.monitorCheckInterval).toBeUndefined();
      expect(config.enableSecureLogging).toBe(false);
      expect(config.enableMetrics).toBe(false);
    });
  });

  describe('createTelegramConfig', () => {
    it('should create Telegram config with all variables', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      process.env.TELEGRAM_MESSAGE_FORMAT = 'simple';
      process.env.TELEGRAM_ENABLE_PREVIEW = 'true';
      process.env.TELEGRAM_RETRY_ATTEMPTS = '5';
      process.env.TELEGRAM_RETRY_DELAY = '2000';

      const config = EnvironmentConfigManager.createTelegramConfig();

      expect(config).toEqual({
        botToken: 'test-token',
        chatId: 'test-chat-id',
        messageFormat: 'simple',
        enablePreview: true,
        retryAttempts: 5,
        retryDelay: 2000,
        isChannel: false
      });
    });

    it('should use defaults for optional variables', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const config = EnvironmentConfigManager.createTelegramConfig();

      expect(config).toEqual({
        botToken: 'test-token',
        chatId: 'test-chat-id',
        messageFormat: 'detailed',
        enablePreview: true,
        retryAttempts: 3,
        retryDelay: 1000,
        isChannel: false
      });
    });

    it('should return null when required variables are missing', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      // Missing TELEGRAM_CHAT_ID

      const config = EnvironmentConfigManager.createTelegramConfig();
      expect(config).toBeNull();
    });
  });

  describe('validateTelegramEnvironment', () => {
    it('should validate successfully with all required variables', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const result = EnvironmentConfigManager.validateTelegramEnvironment();

      expect(result.isValid).toBe(true);
      expect(result.missingVars).toEqual([]);
    });

    it('should identify missing variables', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const result = EnvironmentConfigManager.validateTelegramEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toEqual(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
    });
  });

  describe('utility methods', () => {
    it('should get environment variable with fallback', () => {
      process.env.TEST_VAR = 'test-value';

      expect(EnvironmentConfigManager.getEnvVar('TEST_VAR')).toBe('test-value');
      expect(EnvironmentConfigManager.getEnvVar('MISSING_VAR', 'fallback')).toBe('fallback');
      expect(EnvironmentConfigManager.getEnvVar('MISSING_VAR')).toBeUndefined();
    });

    it('should get boolean environment variable', () => {
      process.env.TRUE_VAR = 'true';
      process.env.FALSE_VAR = 'false';
      process.env.INVALID_VAR = 'invalid';

      expect(EnvironmentConfigManager.getBooleanEnvVar('TRUE_VAR')).toBe(true);
      expect(EnvironmentConfigManager.getBooleanEnvVar('FALSE_VAR')).toBe(false);
      expect(EnvironmentConfigManager.getBooleanEnvVar('INVALID_VAR')).toBe(false);
      expect(EnvironmentConfigManager.getBooleanEnvVar('MISSING_VAR', true)).toBe(true);
    });

    it('should get numeric environment variable', () => {
      process.env.NUMERIC_VAR = '123';
      process.env.INVALID_NUMERIC = 'not-a-number';

      expect(EnvironmentConfigManager.getNumericEnvVar('NUMERIC_VAR')).toBe(123);
      expect(EnvironmentConfigManager.getNumericEnvVar('INVALID_NUMERIC', 456)).toBe(456);
      expect(EnvironmentConfigManager.getNumericEnvVar('MISSING_VAR')).toBeUndefined();
      expect(EnvironmentConfigManager.getNumericEnvVar('MISSING_VAR', 789)).toBe(789);
    });
  });

  describe('maskSensitiveConfig', () => {
    it('should mask sensitive configuration data', () => {
      const config = {
        botToken: '1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        chatId: '123456789',
        messageFormat: 'detailed'
      };

      const masked = EnvironmentConfigManager.maskSensitiveConfig(config);

      expect(masked.botToken).toBe('1234567890***');
      expect(masked.chatId).toBe('123***');
      expect(masked.messageFormat).toBe('detailed');
    });

    it('should handle missing sensitive fields', () => {
      const config = {
        messageFormat: 'simple'
      };

      const masked = EnvironmentConfigManager.maskSensitiveConfig(config);
      expect(masked).toEqual(config);
    });
  });
});