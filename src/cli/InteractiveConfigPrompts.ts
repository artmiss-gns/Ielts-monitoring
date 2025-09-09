import * as readline from 'readline';
import chalk from 'chalk';
import { MonitorConfig } from '../models/types';

/**
 * Interactive configuration prompts for CLI setup
 */
export class InteractiveConfigPrompts {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompt user for complete configuration
   */
  async promptForConfiguration(currentConfig?: MonitorConfig): Promise<MonitorConfig> {
    console.log(chalk.blue('🔧 Interactive Configuration Setup'));
    console.log(chalk.gray('Press Enter to use default values shown in [brackets]\n'));

    const config: MonitorConfig = {
      city: await this.promptForCities(currentConfig?.city),
      examModel: await this.promptForExamModels(currentConfig?.examModel),
      months: await this.promptForMonths(currentConfig?.months),
      checkInterval: await this.promptForCheckInterval(currentConfig?.checkInterval),
      baseUrl: await this.promptForBaseUrl(currentConfig?.baseUrl),
      notificationSettings: await this.promptForNotificationSettings(currentConfig?.notificationSettings)
    };

    this.rl.close();
    return config;
  }

  /**
   * Prompt for cities to monitor
   */
  private async promptForCities(current?: string[]): Promise<string[]> {
    const defaultCities = current || ['isfahan'];
    const availableCities = [
      'isfahan', 'tehran', 'mashhad', 'shiraz', 'tabriz', 'ahvaz', 'qom', 'karaj'
    ];

    console.log(chalk.cyan('📍 Cities to monitor:'));
    console.log(chalk.gray(`Available cities: ${availableCities.join(', ')}`));
    
    const input = await this.question(
      `Enter cities (comma-separated) [${defaultCities.join(', ')}]: `
    );

    if (!input.trim()) {
      return defaultCities;
    }

    const cities = input.split(',').map(city => city.trim().toLowerCase()).filter(city => city);
    
    // Validate cities
    const invalidCities = cities.filter(city => !availableCities.includes(city));
    if (invalidCities.length > 0) {
      console.log(chalk.yellow(`⚠️  Invalid cities: ${invalidCities.join(', ')}`));
      console.log(chalk.gray('Using default cities instead\n'));
      return defaultCities;
    }

    return cities;
  }

  /**
   * Prompt for exam models to monitor
   */
  private async promptForExamModels(current?: string[]): Promise<string[]> {
    const defaultModels = current || ['cdielts'];
    const availableModels = ['cdielts', 'ielts', 'ukvi'];

    console.log(chalk.cyan('📝 Exam models to monitor:'));
    console.log(chalk.gray(`Available models: ${availableModels.join(', ')}`));
    
    const input = await this.question(
      `Enter exam models (comma-separated) [${defaultModels.join(', ')}]: `
    );

    if (!input.trim()) {
      return defaultModels;
    }

    const models = input.split(',').map(model => model.trim().toLowerCase()).filter(model => model);
    
    // Validate models
    const invalidModels = models.filter(model => !availableModels.includes(model));
    if (invalidModels.length > 0) {
      console.log(chalk.yellow(`⚠️  Invalid exam models: ${invalidModels.join(', ')}`));
      console.log(chalk.gray('Using default models instead\n'));
      return defaultModels;
    }

    return models;
  }

  /**
   * Prompt for months to monitor
   */
  private async promptForMonths(current?: number[]): Promise<number[]> {
    const defaultMonths = current || [12, 1, 2];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    console.log(chalk.cyan('📅 Months to monitor:'));
    console.log(chalk.gray('Enter month numbers (1-12) or month names'));
    
    const defaultDisplay = defaultMonths.map(m => `${m} (${monthNames[m-1]})`).join(', ');
    const input = await this.question(
      `Enter months (comma-separated) [${defaultDisplay}]: `
    );

    if (!input.trim()) {
      return defaultMonths;
    }

    const monthInputs = input.split(',').map(m => m.trim());
    const months: number[] = [];

    for (const monthInput of monthInputs) {
      const monthNum = parseInt(monthInput, 10);
      
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        months.push(monthNum);
      } else {
        // Try to match month name
        const monthIndex = monthNames.findIndex(name => 
          name.toLowerCase().startsWith(monthInput.toLowerCase())
        );
        if (monthIndex !== -1) {
          months.push(monthIndex + 1);
        }
      }
    }

    if (months.length === 0) {
      console.log(chalk.yellow('⚠️  No valid months entered'));
      console.log(chalk.gray('Using default months instead\n'));
      return defaultMonths;
    }

    // Remove duplicates and sort
    const uniqueMonths = [...new Set(months)].sort((a, b) => a - b);
    return uniqueMonths;
  }

  /**
   * Prompt for check interval
   */
  private async promptForCheckInterval(current?: number): Promise<number> {
    const defaultInterval = current || 30000;
    const defaultSeconds = defaultInterval / 1000;

    console.log(chalk.cyan('⏱️  Check interval:'));
    console.log(chalk.gray('How often to check for new appointments (minimum 5 seconds)'));
    
    const input = await this.question(
      `Enter interval in seconds [${defaultSeconds}]: `
    );

    if (!input.trim()) {
      return defaultInterval;
    }

    const seconds = parseInt(input, 10);
    
    if (isNaN(seconds) || seconds < 5) {
      console.log(chalk.yellow('⚠️  Invalid interval (minimum 5 seconds)'));
      console.log(chalk.gray('Using default interval instead\n'));
      return defaultInterval;
    }

    if (seconds > 3600) {
      console.log(chalk.yellow('⚠️  Interval too long (maximum 1 hour)'));
      console.log(chalk.gray('Using default interval instead\n'));
      return defaultInterval;
    }

    return seconds * 1000;
  }

  /**
   * Prompt for base URL
   */
  private async promptForBaseUrl(current?: string): Promise<string> {
    const defaultUrl = current || 'https://irsafam.org/ielts/timetable';

    console.log(chalk.cyan('🌐 Base URL:'));
    console.log(chalk.gray('URL to monitor for IELTS appointments'));
    console.log(chalk.gray('Use default for production, or localhost for testing'));
    
    const input = await this.question(
      `Enter base URL [${defaultUrl}]: `
    );

    if (!input.trim()) {
      return defaultUrl;
    }

    const url = input.trim();
    
    // Basic URL validation
    try {
      new URL(url);
      return url;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Invalid URL format'));
      console.log(chalk.gray('Using default URL instead\n'));
      return defaultUrl;
    }
  }

  /**
   * Prompt for notification settings
   */
  private async promptForNotificationSettings(current?: any): Promise<any> {
    const defaultSettings = current || {
      desktop: true,
      audio: true,
      logFile: true
    };

    console.log(chalk.cyan('🔔 Notification settings:'));
    
    const desktop = await this.promptForBoolean(
      'Enable desktop notifications', 
      defaultSettings.desktop
    );
    
    const audio = await this.promptForBoolean(
      'Enable audio alerts', 
      defaultSettings.audio
    );
    
    const logFile = await this.promptForBoolean(
      'Enable log file notifications', 
      defaultSettings.logFile
    );

    // Ensure at least one notification method is enabled
    if (!desktop && !audio && !logFile) {
      console.log(chalk.yellow('⚠️  At least one notification method must be enabled'));
      console.log(chalk.gray('Enabling log file notifications\n'));
      return { desktop, audio, logFile: true };
    }

    return { desktop, audio, logFile };
  }

  /**
   * Prompt for boolean value
   */
  private async promptForBoolean(prompt: string, defaultValue: boolean): Promise<boolean> {
    const defaultDisplay = defaultValue ? 'Y/n' : 'y/N';
    const input = await this.question(`${prompt} [${defaultDisplay}]: `);
    
    if (!input.trim()) {
      return defaultValue;
    }

    const normalized = input.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes' || normalized === 'true';
  }

  /**
   * Confirm restart prompt
   */
  async confirmRestart(): Promise<boolean> {
    const input = await this.question(
      chalk.yellow('Monitor is currently running. Restart with new configuration? [Y/n]: ')
    );
    
    if (!input.trim()) {
      return true;
    }

    const normalized = input.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes' || normalized === 'true';
  }

  /**
   * Wrapper for readline question
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }
}