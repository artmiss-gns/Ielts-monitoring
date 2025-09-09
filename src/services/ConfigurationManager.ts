import * as fs from 'fs-extra';
import * as path from 'path';
import { MonitorConfig, ValidationResult } from '../models/types';

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
    return {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [12, 1, 2], // December, January, February
      checkInterval: 30000, // 30 seconds
      baseUrl: 'https://irsafam.org/ielts/timetable', // Default to real website
      notificationSettings: {
        desktop: true,
        audio: true,
        logFile: true
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

      // Check if config file exists
      if (await fs.pathExists(this.configPath)) {
        const configData = await fs.readJson(this.configPath);
        const validationResult = this.validateConfig(configData);
        
        if (!validationResult.isValid) {
          throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
        }
        
        return configData as MonitorConfig;
      } else {
        // Create default config file if it doesn't exist
        await this.saveConfig(this.defaultConfig);
        return this.defaultConfig;
      }
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    const errors: string[] = [];

    // Check if config is an object
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be a valid object']
      };
    }

    // Validate city field
    if (!Array.isArray(config.city)) {
      errors.push('city must be an array of strings');
    } else if (config.city.length === 0) {
      errors.push('city array cannot be empty');
    } else if (!config.city.every((city: any) => typeof city === 'string' && city.trim().length > 0)) {
      errors.push('city array must contain only non-empty strings');
    }

    // Validate examModel field
    if (!Array.isArray(config.examModel)) {
      errors.push('examModel must be an array of strings');
    } else if (config.examModel.length === 0) {
      errors.push('examModel array cannot be empty');
    } else if (!config.examModel.every((model: any) => typeof model === 'string' && model.trim().length > 0)) {
      errors.push('examModel array must contain only non-empty strings');
    }

    // Validate months field
    if (!Array.isArray(config.months)) {
      errors.push('months must be an array of numbers');
    } else if (config.months.length === 0) {
      errors.push('months array cannot be empty');
    } else if (!config.months.every((month: any) => Number.isInteger(month) && month >= 1 && month <= 12)) {
      errors.push('months array must contain only integers between 1 and 12');
    }

    // Validate checkInterval field
    if (!Number.isInteger(config.checkInterval)) {
      errors.push('checkInterval must be an integer');
    } else if (config.checkInterval < 5000) {
      errors.push('checkInterval must be at least 5000ms (5 seconds) to avoid overwhelming the server');
    } else if (config.checkInterval > 3600000) {
      errors.push('checkInterval must be at most 3600000ms (1 hour) for practical monitoring');
    }

    // Validate baseUrl field (optional)
    if (config.baseUrl !== undefined) {
      if (typeof config.baseUrl !== 'string') {
        errors.push('baseUrl must be a string');
      } else if (config.baseUrl.trim().length === 0) {
        errors.push('baseUrl cannot be empty');
      } else {
        try {
          new URL(config.baseUrl);
        } catch {
          errors.push('baseUrl must be a valid URL');
        }
      }
    }

    // Validate notificationSettings field
    if (!config.notificationSettings || typeof config.notificationSettings !== 'object') {
      errors.push('notificationSettings must be a valid object');
    } else {
      const notificationErrors = this.validateNotificationSettings(config.notificationSettings);
      errors.push(...notificationErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates notification settings
   */
  private validateNotificationSettings(settings: any): string[] {
    const errors: string[] = [];

    if (typeof settings.desktop !== 'boolean') {
      errors.push('notificationSettings.desktop must be a boolean');
    }

    if (typeof settings.audio !== 'boolean') {
      errors.push('notificationSettings.audio must be a boolean');
    }

    if (typeof settings.logFile !== 'boolean') {
      errors.push('notificationSettings.logFile must be a boolean');
    }

    // Ensure at least one notification method is enabled
    if (settings.desktop === false && settings.audio === false && settings.logFile === false) {
      errors.push('At least one notification method (desktop, audio, or logFile) must be enabled');
    }

    return errors;
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