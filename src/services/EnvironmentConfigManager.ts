import { TelegramConfig, EnvironmentConfig } from '../models/types';

/**
 * Environment configuration manager for loading settings from environment variables
 */
export class EnvironmentConfigManager {
  /**
   * Load environment configuration from process.env
   */
  static loadEnvironmentConfig(): EnvironmentConfig {
    return {
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      monitorCheckInterval: process.env.MONITOR_CHECK_INTERVAL ? parseInt(process.env.MONITOR_CHECK_INTERVAL) : undefined,
      monitorCities: process.env.MONITOR_CITIES ? process.env.MONITOR_CITIES.split(',').map(city => city.trim()) : undefined,
      monitorExamModels: process.env.MONITOR_EXAM_MODELS ? process.env.MONITOR_EXAM_MODELS.split(',').map(model => model.trim()) : undefined,
      monitorMonths: process.env.MONITOR_MONTHS ? process.env.MONITOR_MONTHS.split(',').map(month => parseInt(month.trim())) : undefined,
      monitorBaseUrl: process.env.MONITOR_BASE_URL,
      logLevel: process.env.MONITOR_LOG_LEVEL,
      enableSecureLogging: process.env.ENABLE_SECURE_LOGGING === 'true',
      maskSensitiveData: process.env.MASK_SENSITIVE_DATA === 'true',
      healthCheckPort: process.env.HEALTH_CHECK_PORT ? parseInt(process.env.HEALTH_CHECK_PORT) : undefined,
      enableMetrics: process.env.ENABLE_METRICS === 'true'
    };
  }

  /**
   * Create Telegram configuration from environment variables
   */
  static createTelegramConfig(): TelegramConfig | null {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return null;
    }

    // Auto-detect if it's a channel based on chatId format
    const isChannel = chatId.startsWith('@') || chatId.startsWith('-100');

    return {
      botToken,
      chatId,
      messageFormat: (process.env.TELEGRAM_MESSAGE_FORMAT as 'simple' | 'detailed') || 'detailed',
      enablePreview: process.env.TELEGRAM_ENABLE_PREVIEW !== 'false', // Default to true
      retryAttempts: process.env.TELEGRAM_RETRY_ATTEMPTS ? parseInt(process.env.TELEGRAM_RETRY_ATTEMPTS) : 3,
      retryDelay: process.env.TELEGRAM_RETRY_DELAY ? parseInt(process.env.TELEGRAM_RETRY_DELAY) : 1000,
      isChannel: process.env.TELEGRAM_IS_CHANNEL === 'true' || isChannel
    };
  }

  /**
   * Validate required environment variables for Telegram
   */
  static validateTelegramEnvironment(): { isValid: boolean; missingVars: string[] } {
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    return {
      isValid: missingVars.length === 0,
      missingVars
    };
  }

  /**
   * Get environment variable with fallback
   */
  static getEnvVar(name: string, fallback?: string): string | undefined {
    return process.env[name] || fallback;
  }

  /**
   * Get boolean environment variable
   */
  static getBooleanEnvVar(name: string, fallback: boolean = false): boolean {
    const value = process.env[name];
    if (value === undefined) return fallback;
    return value.toLowerCase() === 'true';
  }

  /**
   * Get numeric environment variable
   */
  static getNumericEnvVar(name: string, fallback?: number): number | undefined {
    const value = process.env[name];
    if (value === undefined) return fallback;
    const parsed = parseInt(value);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Mask sensitive data in configuration for logging
   */
  static maskSensitiveConfig(config: any): any {
    const masked = { ...config };
    
    // Mask bot token
    if (masked.botToken) {
      masked.botToken = masked.botToken.substring(0, 10) + '***';
    }
    
    // Mask chat ID (show only first 3 characters)
    if (masked.chatId) {
      masked.chatId = masked.chatId.substring(0, 3) + '***';
    }

    return masked;
  }

  /**
   * Print environment configuration status
   */
  static printConfigStatus(): void {
    const telegramValidation = this.validateTelegramEnvironment();
    
    console.log('\n📋 Environment Configuration Status:');
    console.log('=====================================');
    
    if (telegramValidation.isValid) {
      console.log('✅ Telegram: Configured');
      const config = this.createTelegramConfig();
      if (config) {
        const masked = this.maskSensitiveConfig(config);
        console.log(`   Bot Token: ${masked.botToken}`);
        console.log(`   Target: ${config.isChannel ? 'Channel' : 'Chat'} ${masked.chatId}`);
        console.log(`   Message Format: ${config.messageFormat}`);
        console.log(`   Enable Preview: ${config.enablePreview}`);
      }
    } else {
      console.log('❌ Telegram: Not configured');
      console.log(`   Missing variables: ${telegramValidation.missingVars.join(', ')}`);
    }

    // Other environment variables
    const otherVars = [
      { name: 'MONITOR_CHECK_INTERVAL', value: process.env.MONITOR_CHECK_INTERVAL },
      { name: 'MONITOR_CITIES', value: process.env.MONITOR_CITIES },
      { name: 'MONITOR_EXAM_MODELS', value: process.env.MONITOR_EXAM_MODELS },
      { name: 'MONITOR_LOG_LEVEL', value: process.env.MONITOR_LOG_LEVEL }
    ];

    const configuredVars = otherVars.filter(v => v.value);
    if (configuredVars.length > 0) {
      console.log('\n🔧 Other Configuration:');
      configuredVars.forEach(v => {
        console.log(`   ${v.name}: ${v.value}`);
      });
    }

    console.log('=====================================\n');
  }
}