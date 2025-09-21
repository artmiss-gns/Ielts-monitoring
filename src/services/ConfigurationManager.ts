import * as fs from 'fs-extra';
import * as path from 'path';
import { MonitorConfig, ValidationResult } from '../models/types';
import { ConfigValidator } from '../utils/ConfigValidator';
import { EnvironmentConfigManager } from './EnvironmentConfigManager';

/**
 * Configuration Manager handles loading, saving, and validating monitor configuration
 */
export class ConfigurationManager {
  private readonly configPath: string;
  private readonly defaultConfig: MonitorConfig;

  constructor(configPath: string = 'config/monitor-config.json') {
    this.configPath = configPath;
    this.defaultConfig = this.createDefaultConfig();
  }

  /**
   * Creates the default configuration template
   */
  private createDefaultConfig(): MonitorConfig {
    // Check for Telegram credentials to set appropriate default
    const telegramValidation = EnvironmentConfigManager.validateTelegramEnvironment();
    const telegramDefault = telegramValidation.isValid;

    return {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [12, 1, 2], // December, January, February
      checkInterval: 300000, // 5 minutes for server deployment
      baseUrl: 'https://irsafam.org/ielts/timetable', // Default to real website
      notificationSettings: {
        desktop: false, // Disabled for server deployment
        audio: false, // Disabled for server deployment
        logFile: true,
        telegram: telegramDefault // Enabled if credentials are available
      },
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
  }

  /**
   * Loads configuration from file or returns default configuration
   */
  async loadConfig(): Promise<MonitorConfig> {
    try {
      // Ensure config directory exists
      await fs.ensureDir(path.dirname(this.configPath));

      let config: MonitorConfig;

      // Check if config file exists
      if (await fs.pathExists(this.configPath)) {
        const configData = await fs.readJson(this.configPath);
        const validationResult = this.validateConfig(configData);
        
        if (!validationResult.isValid) {
          throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
        }
        
        config = configData as MonitorConfig;
      } else {
        // Create default config file if it doesn't exist
        config = { ...this.defaultConfig };
        await this.saveConfig(config);
      }

      // Auto-enable Telegram notifications if credentials are available
      config = this.autoEnableTelegramIfConfigured(config);

      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Automatically enable Telegram notifications if environment variables are configured
   */
  private autoEnableTelegramIfConfigured(config: MonitorConfig): MonitorConfig {
    const telegramValidation = EnvironmentConfigManager.validateTelegramEnvironment();
    
    // Only auto-enable if credentials are valid and Telegram is currently disabled
    if (telegramValidation.isValid && !config.notificationSettings.telegram) {
      console.log('🔔 Telegram credentials detected - automatically enabling Telegram notifications');
      config.notificationSettings.telegram = true;
    }
    
    return config;
  }

  /**
   * Saves configuration to file
   */
  async saveConfig(config: MonitorConfig): Promise<void> {
    try {
      // Validate configuration before saving
      const validationResult = this.validateConfig(config);
      if (!validationResult.isValid) {
        throw new Error(`Cannot save invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      // Ensure config directory exists
      await fs.ensureDir(path.dirname(this.configPath));

      // Save configuration with pretty formatting
      await fs.writeJson(this.configPath, config, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates configuration and returns validation result with detailed errors
   */
  validateConfig(config: any): ValidationResult {
    // Check if config is an object
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be a valid object']
      };
    }

    // Use ConfigValidator for validation
    const cityValidation = ConfigValidator.validateStringArray(config.city, 'city', true);
    const examModelValidation = ConfigValidator.validateStringArray(config.examModel, 'examModel', true);
    const monthsValidation = ConfigValidator.validateNumberArray(config.months, 'months', 1, 12, true);
    const checkIntervalValidation = ConfigValidator.validateInteger(config.checkInterval, 'checkInterval', 5000, 3600000, true);
    const baseUrlValidation = ConfigValidator.validateUrl(config.baseUrl, 'baseUrl', false);

    // Validate notification settings
    const notificationValidation = this.validateNotificationSettings(config.notificationSettings);

    // Validate security settings
    const securityValidation = this.validateSecuritySettings(config.security);

    // Validate server settings
    const serverValidation = this.validateServerSettings(config.server);

    return ConfigValidator.combineValidationResults(
      cityValidation,
      examModelValidation,
      monthsValidation,
      checkIntervalValidation,
      baseUrlValidation,
      notificationValidation,
      securityValidation,
      serverValidation
    );
  }

  /**
   * Validates notification settings
   */
  private validateNotificationSettings(settings: any): ValidationResult {
    if (!settings || typeof settings !== 'object') {
      return {
        isValid: false,
        errors: ['notificationSettings must be a valid object']
      };
    }

    const desktopValidation = ConfigValidator.validateBoolean(settings.desktop, 'notificationSettings.desktop', true);
    const audioValidation = ConfigValidator.validateBoolean(settings.audio, 'notificationSettings.audio', true);
    const logFileValidation = ConfigValidator.validateBoolean(settings.logFile, 'notificationSettings.logFile', true);
    const telegramValidation = ConfigValidator.validateBoolean(settings.telegram, 'notificationSettings.telegram', false);

    const combinedValidation = ConfigValidator.combineValidationResults(
      desktopValidation,
      audioValidation,
      logFileValidation,
      telegramValidation
    );

    // Ensure at least one notification method is enabled
    if (combinedValidation.isValid) {
      const hasEnabledMethod = settings.desktop || settings.audio || settings.logFile || settings.telegram;
      if (!hasEnabledMethod) {
        combinedValidation.errors.push('At least one notification method (desktop, audio, logFile, or telegram) must be enabled');
        combinedValidation.isValid = false;
      }
    }

    return combinedValidation;
  }

  /**
   * Validates security settings
   */
  private validateSecuritySettings(settings: any): ValidationResult {
    if (!settings) {
      return { isValid: true, errors: [] }; // Security settings are optional
    }

    if (typeof settings !== 'object') {
      return {
        isValid: false,
        errors: ['security must be a valid object']
      };
    }

    const enableSecureLoggingValidation = ConfigValidator.validateBoolean(settings.enableSecureLogging, 'security.enableSecureLogging', false);
    const maskSensitiveDataValidation = ConfigValidator.validateBoolean(settings.maskSensitiveData, 'security.maskSensitiveData', false);
    const logLevelValidation = ConfigValidator.validateEnum(settings.logLevel, 'security.logLevel', ['error', 'warn', 'info', 'debug'], false);

    return ConfigValidator.combineValidationResults(
      enableSecureLoggingValidation,
      maskSensitiveDataValidation,
      logLevelValidation
    );
  }

  /**
   * Validates server settings
   */
  private validateServerSettings(settings: any): ValidationResult {
    if (!settings) {
      return { isValid: true, errors: [] }; // Server settings are optional
    }

    if (typeof settings !== 'object') {
      return {
        isValid: false,
        errors: ['server must be a valid object']
      };
    }

    const enableHealthCheckValidation = ConfigValidator.validateBoolean(settings.enableHealthCheck, 'server.enableHealthCheck', false);
    const healthCheckPortValidation = ConfigValidator.validatePort(settings.healthCheckPort, 'server.healthCheckPort');
    const enableMetricsValidation = ConfigValidator.validateBoolean(settings.enableMetrics, 'server.enableMetrics', false);

    return ConfigValidator.combineValidationResults(
      enableHealthCheckValidation,
      healthCheckPortValidation,
      enableMetricsValidation
    );
  }

  /**
   * Gets the default configuration template
   */
  getDefaultConfig(): MonitorConfig {
    return JSON.parse(JSON.stringify(this.defaultConfig)); // Deep copy
  }

  /**
   * Gets the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Checks if configuration file exists
   */
  async configExists(): Promise<boolean> {
    return fs.pathExists(this.configPath);
  }

  /**
   * Resets configuration to default values
   */
  async resetToDefault(): Promise<void> {
    await this.saveConfig(this.defaultConfig);
  }
}