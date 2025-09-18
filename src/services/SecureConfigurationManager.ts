import * as fs from 'fs-extra';
import { MonitorConfig, TelegramConfig, EnvironmentConfig, ValidationResult } from '../models/types';

/**
 * Secure Configuration Manager handles loading configuration from environment variables
 * and configuration files with proper validation and security measures
 */
export class SecureConfigurationManager {
  private readonly configPath: string;
  private readonly telegramConfigPath: string;

  constructor(
    configPath: string = 'config/monitor-config.json',
    telegramConfigPath: string = 'config/telegram-config.json'
  ) {
    this.configPath = configPath;
    this.telegramConfigPath = telegramConfigPath;
  }

  /**
   * Loads configuration from environment variables and config files
   */
  async loadSecureConfig(): Promise<MonitorConfig> {
    try {
      // Load environment variables
      const envConfig = this.loadEnvironmentConfig();
      
      // Load base configuration from file (if exists)
      let fileConfig: Partial<MonitorConfig> = {};
      if (await fs.pathExists(this.configPath)) {
        fileConfig = await fs.readJson(this.configPath);
      }

      // Merge configurations with environment taking precedence
      const mergedConfig = this.mergeConfigurations(fileConfig, envConfig);
      
      // Validate the final configuration
      const validationResult = this.validateSecureConfig(mergedConfig);
      if (!validationResult.isValid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      return mergedConfig;
    } catch (error) {
      throw new Error(`Failed to load secure configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Loads Telegram configuration securely
   */
  async loadTelegramConfig(): Promise<TelegramConfig | null> {
    try {
      // Try environment variables first
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        return {
          botToken,
          chatId,
          messageFormat: 'detailed',
          enablePreview: false,
          retryAttempts: 3,
          retryDelay: 5000
        };
      }

      // Fall back to config file if it exists
      if (await fs.pathExists(this.telegramConfigPath)) {
        const config = await fs.readJson(this.telegramConfigPath);
        const validationResult = this.validateTelegramConfig(config);
        
        if (!validationResult.isValid) {
          throw new Error(`Invalid Telegram configuration: ${validationResult.errors.join(', ')}`);
        }
        
        return config as TelegramConfig;
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to load Telegram configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Loads configuration from environment variables
   */
  private loadEnvironmentConfig(): EnvironmentConfig {
    const config: EnvironmentConfig = {};
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
      config.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (process.env.TELEGRAM_CHAT_ID) {
      config.telegramChatId = process.env.TELEGRAM_CHAT_ID;
    }
    if (process.env.MONITOR_CHECK_INTERVAL) {
      config.monitorCheckInterval = parseInt(process.env.MONITOR_CHECK_INTERVAL);
    }
    if (process.env.MONITOR_CITIES) {
      config.monitorCities = process.env.MONITOR_CITIES.split(',').map(c => c.trim());
    }
    if (process.env.MONITOR_EXAM_MODELS) {
      config.monitorExamModels = process.env.MONITOR_EXAM_MODELS.split(',').map(m => m.trim());
    }
    if (process.env.MONITOR_MONTHS) {
      config.monitorMonths = process.env.MONITOR_MONTHS.split(',').map(m => parseInt(m.trim()));
    }
    if (process.env.MONITOR_BASE_URL) {
      config.monitorBaseUrl = process.env.MONITOR_BASE_URL;
    }
    if (process.env.LOG_LEVEL) {
      config.logLevel = process.env.LOG_LEVEL;
    }
    if (process.env.ENABLE_SECURE_LOGGING !== undefined) {
      config.enableSecureLogging = process.env.ENABLE_SECURE_LOGGING === 'true';
    }
    if (process.env.MASK_SENSITIVE_DATA !== undefined) {
      config.maskSensitiveData = process.env.MASK_SENSITIVE_DATA === 'true';
    }
    if (process.env.HEALTH_CHECK_PORT) {
      config.healthCheckPort = parseInt(process.env.HEALTH_CHECK_PORT);
    }
    if (process.env.ENABLE_METRICS !== undefined) {
      config.enableMetrics = process.env.ENABLE_METRICS === 'true';
    }
    
    return config;
  }

  /**
   * Merges file configuration with environment configuration
   */
  private mergeConfigurations(fileConfig: Partial<MonitorConfig>, envConfig: EnvironmentConfig): MonitorConfig {
    const defaultConfig: MonitorConfig = {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [12, 1, 2],
      checkInterval: 300000,
      notificationSettings: {
        desktop: false,
        audio: false,
        logFile: true,
        telegram: false
      },
      baseUrl: 'https://irsafam.org/ielts/timetable',
      security: {
        enableSecureLogging: true,
        maskSensitiveData: true,
        logLevel: 'info'
      },
      server: {
        enableHealthCheck: false,
        healthCheckPort: 3000,
        enableMetrics: false
      }
    };

    // Start with default config
    const mergedConfig: MonitorConfig = { ...defaultConfig };

    // Apply file config
    if (fileConfig.city) mergedConfig.city = fileConfig.city;
    if (fileConfig.examModel) mergedConfig.examModel = fileConfig.examModel;
    if (fileConfig.months) mergedConfig.months = fileConfig.months;
    if (fileConfig.checkInterval) mergedConfig.checkInterval = fileConfig.checkInterval;
    if (fileConfig.baseUrl) mergedConfig.baseUrl = fileConfig.baseUrl;
    
    if (fileConfig.notificationSettings) {
      mergedConfig.notificationSettings = { ...mergedConfig.notificationSettings, ...fileConfig.notificationSettings };
    }
    
    if (fileConfig.security) {
      mergedConfig.security = { ...mergedConfig.security, ...fileConfig.security };
    }
    
    if (fileConfig.server) {
      mergedConfig.server = { ...mergedConfig.server, ...fileConfig.server };
    }

    // Apply environment config (takes precedence)
    if (envConfig.monitorCities) mergedConfig.city = envConfig.monitorCities;
    if (envConfig.monitorExamModels) mergedConfig.examModel = envConfig.monitorExamModels;
    if (envConfig.monitorMonths) mergedConfig.months = envConfig.monitorMonths;
    if (envConfig.monitorCheckInterval) mergedConfig.checkInterval = envConfig.monitorCheckInterval;
    if (envConfig.monitorBaseUrl) mergedConfig.baseUrl = envConfig.monitorBaseUrl;
    
    // Enable Telegram if credentials are provided
    if (envConfig.telegramBotToken && envConfig.telegramChatId) {
      mergedConfig.notificationSettings.telegram = true;
    }

    // Apply security settings from environment
    if (envConfig.logLevel) {
      mergedConfig.security!.logLevel = envConfig.logLevel as 'error' | 'warn' | 'info' | 'debug';
    }
    if (envConfig.enableSecureLogging !== undefined) {
      mergedConfig.security!.enableSecureLogging = envConfig.enableSecureLogging;
    }
    if (envConfig.maskSensitiveData !== undefined) {
      mergedConfig.security!.maskSensitiveData = envConfig.maskSensitiveData;
    }

    // Apply server settings from environment
    if (envConfig.healthCheckPort) {
      mergedConfig.server!.healthCheckPort = envConfig.healthCheckPort;
    }
    if (envConfig.enableMetrics !== undefined) {
      mergedConfig.server!.enableMetrics = envConfig.enableMetrics;
    }

    return mergedConfig;
  }

  /**
   * Validates the secure configuration
   */
  private validateSecureConfig(config: MonitorConfig): ValidationResult {
    const errors: string[] = [];

    // Validate basic fields (reuse existing validation logic)
    if (!Array.isArray(config.city) || config.city.length === 0) {
      errors.push('city must be a non-empty array of strings');
    }

    if (!Array.isArray(config.examModel) || config.examModel.length === 0) {
      errors.push('examModel must be a non-empty array of strings');
    }

    if (!Array.isArray(config.months) || config.months.length === 0) {
      errors.push('months must be a non-empty array of numbers');
    } else if (!config.months.every(month => Number.isInteger(month) && month >= 1 && month <= 12)) {
      errors.push('months must contain only integers between 1 and 12');
    }

    if (!Number.isInteger(config.checkInterval) || config.checkInterval < 5000) {
      errors.push('checkInterval must be an integer of at least 5000ms');
    }

    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push('baseUrl must be a valid URL');
      }
    }

    // Validate security config
    if (config.security) {
      if (typeof config.security.enableSecureLogging !== 'boolean') {
        errors.push('security.enableSecureLogging must be a boolean');
      }
      if (typeof config.security.maskSensitiveData !== 'boolean') {
        errors.push('security.maskSensitiveData must be a boolean');
      }
      if (!['error', 'warn', 'info', 'debug'].includes(config.security.logLevel)) {
        errors.push('security.logLevel must be one of: error, warn, info, debug');
      }
    }

    // Validate server config
    if (config.server) {
      if (typeof config.server.enableHealthCheck !== 'boolean') {
        errors.push('server.enableHealthCheck must be a boolean');
      }
      if (config.server.healthCheckPort && (!Number.isInteger(config.server.healthCheckPort) || config.server.healthCheckPort < 1 || config.server.healthCheckPort > 65535)) {
        errors.push('server.healthCheckPort must be an integer between 1 and 65535');
      }
      if (typeof config.server.enableMetrics !== 'boolean') {
        errors.push('server.enableMetrics must be a boolean');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates Telegram configuration
   */
  private validateTelegramConfig(config: any): ValidationResult {
    const errors: string[] = [];

    if (!config.botToken || typeof config.botToken !== 'string' || config.botToken.trim().length === 0) {
      errors.push('botToken is required and must be a non-empty string');
    }

    if (!config.chatId || typeof config.chatId !== 'string' || config.chatId.trim().length === 0) {
      errors.push('chatId is required and must be a non-empty string');
    }

    if (config.messageFormat && !['simple', 'detailed'].includes(config.messageFormat)) {
      errors.push('messageFormat must be either "simple" or "detailed"');
    }

    if (config.enablePreview !== undefined && typeof config.enablePreview !== 'boolean') {
      errors.push('enablePreview must be a boolean');
    }

    if (config.retryAttempts !== undefined && (!Number.isInteger(config.retryAttempts) || config.retryAttempts < 0)) {
      errors.push('retryAttempts must be a non-negative integer');
    }

    if (config.retryDelay !== undefined && (!Number.isInteger(config.retryDelay) || config.retryDelay < 0)) {
      errors.push('retryDelay must be a non-negative integer');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Masks sensitive data in configuration for logging
   */
  maskSensitiveData(config: any): any {
    const masked = JSON.parse(JSON.stringify(config));
    
    // Mask sensitive fields
    if (masked.botToken) {
      masked.botToken = this.maskString(masked.botToken);
    }
    if (masked.chatId) {
      masked.chatId = this.maskString(masked.chatId);
    }

    return masked;
  }

  /**
   * Masks a string by showing only first and last 2 characters
   */
  private maskString(str: string): string {
    if (str.length <= 4) {
      return '*'.repeat(str.length);
    }
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  }

  /**
   * Checks if configuration contains sensitive data
   */
  hasSensitiveData(config: any): boolean {
    const sensitiveFields = ['botToken', 'chatId', 'password', 'secret', 'key', 'token'];
    return this.containsSensitiveFields(config, sensitiveFields);
  }

  /**
   * Recursively checks for sensitive fields in configuration
   */
  private containsSensitiveFields(obj: any, sensitiveFields: string[]): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        return true;
      }
      if (typeof obj[key] === 'object' && this.containsSensitiveFields(obj[key], sensitiveFields)) {
        return true;
      }
    }

    return false;
  }
}