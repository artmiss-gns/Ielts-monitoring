import { CLIController } from '../CLIController';
import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { MonitorConfig } from '../../models/types';

const { EnvironmentConfigManager } = require('../../services/EnvironmentConfigManager');

// Mock dependencies
jest.mock('../../services/MonitorController');
jest.mock('../../services/ConfigurationManager');
jest.mock('../../services/StatusLoggerService');
jest.mock('../InteractiveConfigPrompts');
jest.mock('../StatusDisplay');
jest.mock('../LogViewer');

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

describe('CLIController', () => {
  let cliController: CLIController;
  let mockMonitorController: jest.Mocked<MonitorController>;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  const mockConfig: MonitorConfig = {
    city: ['isfahan'],
    examModel: ['cdielts'],
    months: [12, 1, 2],
    checkInterval: 30000,
    notificationSettings: {
      desktop: true,
      audio: true,
      logFile: true
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation();
    
    // Default mock for no Telegram credentials
    EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
      isValid: false,
      missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
    });
    
    // Create CLI controller instance
    cliController = new CLIController();
    
    // Get mocked instances
    mockMonitorController = (cliController as any).monitorController;
    mockConfigManager = (cliController as any).configManager;
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('startCommand', () => {
    it('should start monitoring with existing configuration', async () => {
      // Setup mocks
      mockConfigManager.configExists.mockResolvedValue(true);
      mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
      mockMonitorController.startMonitoring.mockResolvedValue();

      // Execute command
      await cliController.startCommand({ daemon: true });

      // Verify calls
      expect(mockConfigManager.configExists).toHaveBeenCalled();
      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockMonitorController.startMonitoring).toHaveBeenCalledWith(mockConfig);
    });

    it('should prompt for configuration if none exists', async () => {
      // Setup mocks
      mockConfigManager.configExists.mockResolvedValue(false);
      mockConfigManager.saveConfig.mockResolvedValue();
      mockMonitorController.startMonitoring.mockResolvedValue();
      
      const mockInteractivePrompts = (cliController as any).interactivePrompts;
      mockInteractivePrompts.promptForConfiguration.mockResolvedValue(mockConfig);

      // Execute command
      await cliController.startCommand({ daemon: true });

      // Verify calls
      expect(mockInteractivePrompts.promptForConfiguration).toHaveBeenCalled();
      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockMonitorController.startMonitoring).toHaveBeenCalledWith(mockConfig);
    });

    it('should use custom config file when specified', async () => {
      // Setup mocks
      const customConfigPath = 'custom-config.json';
      mockMonitorController.startMonitoring.mockResolvedValue();

      // Mock the ConfigurationManager constructor
      const ConfigurationManager = require('../../services/ConfigurationManager').ConfigurationManager;
      jest.spyOn(ConfigurationManager.prototype, 'configExists').mockResolvedValue(true);
      jest.spyOn(ConfigurationManager.prototype, 'loadConfig').mockResolvedValue(mockConfig);

      // Execute command
      await cliController.startCommand({ config: customConfigPath, daemon: true });

      // Verify that monitoring was started with the config
      expect(mockMonitorController.startMonitoring).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle start errors gracefully', async () => {
      // Setup mocks
      mockConfigManager.configExists.mockResolvedValue(true);
      mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
      mockMonitorController.startMonitoring.mockRejectedValue(new Error('Start failed'));

      // Execute command and expect error
      await expect(cliController.startCommand({ daemon: true }))
        .rejects.toThrow('Failed to start monitoring: Start failed');
    });
  });

  describe('stopCommand', () => {
    it('should stop running monitor', async () => {
      // Setup mocks
      mockMonitorController.getStatus.mockResolvedValue({
        status: MonitorStatus.RUNNING,
        statistics: {
          sessionId: 'test-session',
          startTime: new Date(),
          uptime: 60000,
          checksPerformed: 10,
          notificationsSent: 2,
          errorsEncountered: 0,
          averageCheckInterval: 30000,
          lastCheckTime: new Date(),
          lastNotificationTime: new Date()
        }
      });
      mockMonitorController.stopMonitoring.mockResolvedValue();

      // Execute command
      await cliController.stopCommand();

      // Verify calls
      expect(mockMonitorController.getStatus).toHaveBeenCalled();
      expect(mockMonitorController.stopMonitoring).toHaveBeenCalled();
    });

    it('should handle already stopped monitor', async () => {
      // Setup mocks
      mockMonitorController.getStatus.mockResolvedValue({
        status: MonitorStatus.STOPPED
      });

      // Execute command (should not throw)
      await cliController.stopCommand();

      // Verify calls
      expect(mockMonitorController.getStatus).toHaveBeenCalled();
      expect(mockMonitorController.stopMonitoring).not.toHaveBeenCalled();
    });

    it('should handle stop errors gracefully', async () => {
      // Setup mocks
      mockMonitorController.getStatus.mockResolvedValue({
        status: MonitorStatus.RUNNING
      });
      mockMonitorController.stopMonitoring.mockRejectedValue(new Error('Stop failed'));

      // Execute command and expect error
      await expect(cliController.stopCommand())
        .rejects.toThrow('Failed to stop monitoring: Stop failed');
    });
  });

  describe('statusCommand', () => {
    it('should display status in human readable format', async () => {
      // Setup mocks
      const mockStatus = {
        status: MonitorStatus.RUNNING,
        session: {
          sessionId: 'test-session',
          startTime: new Date(),
          checksPerformed: 5,
          notificationsSent: 1,
          errors: [],
          configuration: mockConfig
        },
        statistics: {
          sessionId: 'test-session',
          startTime: new Date(),
          uptime: 30000,
          checksPerformed: 5,
          notificationsSent: 1,
          errorsEncountered: 0
        },
        config: mockConfig
      };

      mockMonitorController.getStatus.mockResolvedValue(mockStatus);
      const mockStatusDisplay = (cliController as any).statusDisplay;

      // Execute command
      await cliController.statusCommand({});

      // Verify calls
      expect(mockMonitorController.getStatus).toHaveBeenCalled();
      expect(mockStatusDisplay.displayStatus).toHaveBeenCalledWith(mockStatus);
    });

    it('should display status in JSON format when requested', async () => {
      // Setup mocks
      const mockStatus = { status: MonitorStatus.RUNNING };
      mockMonitorController.getStatus.mockResolvedValue(mockStatus);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute command
      await cliController.statusCommand({ json: true });

      // Verify JSON output
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockStatus, null, 2));
      
      consoleSpy.mockRestore();
    });

    it('should start watch mode when requested', async () => {
      // Setup mocks
      const mockStatusDisplay = (cliController as any).statusDisplay;

      // Execute command
      await cliController.statusCommand({ watch: true });

      // Verify calls
      expect(mockStatusDisplay.startWatchMode).toHaveBeenCalledWith(mockMonitorController);
    });
  });

  describe('configureCommand', () => {
    it('should run interactive configuration', async () => {
      // Setup mocks
      mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
      mockConfigManager.saveConfig.mockResolvedValue();
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.STOPPED);
      
      const mockInteractivePrompts = (cliController as any).interactivePrompts;
      mockInteractivePrompts.promptForConfiguration.mockResolvedValue(mockConfig);

      // Execute command
      await cliController.configureCommand({});

      // Verify calls
      expect(mockInteractivePrompts.promptForConfiguration).toHaveBeenCalledWith(mockConfig);
      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should reset configuration when requested', async () => {
      // Setup mocks
      mockConfigManager.resetToDefault.mockResolvedValue();
      mockConfigManager.getDefaultConfig.mockReturnValue(mockConfig);

      // Execute command
      await cliController.configureCommand({ reset: true });

      // Verify calls
      expect(mockConfigManager.resetToDefault).toHaveBeenCalled();
      expect(mockConfigManager.getDefaultConfig).toHaveBeenCalled();
    });

    it('should offer to restart monitor if running', async () => {
      // Setup mocks
      mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
      mockConfigManager.saveConfig.mockResolvedValue();
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.RUNNING);
      mockMonitorController.updateConfiguration.mockResolvedValue();
      
      const mockInteractivePrompts = (cliController as any).interactivePrompts;
      mockInteractivePrompts.promptForConfiguration.mockResolvedValue(mockConfig);
      mockInteractivePrompts.confirmRestart.mockResolvedValue(true);

      // Execute command
      await cliController.configureCommand({});

      // Verify calls
      expect(mockInteractivePrompts.confirmRestart).toHaveBeenCalled();
      expect(mockMonitorController.updateConfiguration).toHaveBeenCalledWith(mockConfig);
    });

    it('should display configuration summary after saving', async () => {
      // Setup mocks
      mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
      mockConfigManager.saveConfig.mockResolvedValue();
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.STOPPED);
      
      const mockInteractivePrompts = (cliController as any).interactivePrompts;
      mockInteractivePrompts.promptForConfiguration.mockResolvedValue(mockConfig);

      const displayConfigurationSummarySpy = jest.spyOn(cliController as any, 'displayConfigurationSummary');

      // Execute command
      await cliController.configureCommand({});

      // Verify configuration summary is displayed
      expect(displayConfigurationSummarySpy).toHaveBeenCalledWith(mockConfig);
    });

    it('should display configuration summary after reset', async () => {
      // Setup mocks
      mockConfigManager.resetToDefault.mockResolvedValue();
      mockConfigManager.getDefaultConfig.mockReturnValue(mockConfig);

      const displayConfigurationSummarySpy = jest.spyOn(cliController as any, 'displayConfigurationSummary');

      // Execute command
      await cliController.configureCommand({ reset: true });

      // Verify configuration summary is displayed
      expect(displayConfigurationSummarySpy).toHaveBeenCalledWith(mockConfig);
    });

    it('should use default config when loading existing config fails', async () => {
      // Setup mocks
      mockConfigManager.loadConfig.mockRejectedValue(new Error('Config not found'));
      mockConfigManager.getDefaultConfig.mockReturnValue(mockConfig);
      mockConfigManager.saveConfig.mockResolvedValue();
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.STOPPED);
      
      const mockInteractivePrompts = (cliController as any).interactivePrompts;
      mockInteractivePrompts.promptForConfiguration.mockResolvedValue(mockConfig);

      // Execute command
      await cliController.configureCommand({});

      // Verify calls
      expect(mockConfigManager.getDefaultConfig).toHaveBeenCalled();
      expect(mockInteractivePrompts.promptForConfiguration).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('pauseCommand', () => {
    it('should pause running monitor', async () => {
      // Setup mocks
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.RUNNING);
      mockMonitorController.pauseMonitoring.mockResolvedValue();

      // Execute command
      await cliController.pauseCommand();

      // Verify calls
      expect(mockMonitorController.getCurrentStatus).toHaveBeenCalled();
      expect(mockMonitorController.pauseMonitoring).toHaveBeenCalled();
    });

    it('should handle non-running monitor gracefully', async () => {
      // Setup mocks
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.STOPPED);

      // Execute command (should not throw)
      await cliController.pauseCommand();

      // Verify calls
      expect(mockMonitorController.getCurrentStatus).toHaveBeenCalled();
      expect(mockMonitorController.pauseMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('resumeCommand', () => {
    it('should resume paused monitor', async () => {
      // Setup mocks
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.PAUSED);
      mockMonitorController.resumeMonitoring.mockResolvedValue();

      // Execute command
      await cliController.resumeCommand();

      // Verify calls
      expect(mockMonitorController.getCurrentStatus).toHaveBeenCalled();
      expect(mockMonitorController.resumeMonitoring).toHaveBeenCalled();
    });

    it('should handle non-paused monitor gracefully', async () => {
      // Setup mocks
      mockMonitorController.getCurrentStatus.mockReturnValue(MonitorStatus.RUNNING);

      // Execute command (should not throw)
      await cliController.resumeCommand();

      // Verify calls
      expect(mockMonitorController.getCurrentStatus).toHaveBeenCalled();
      expect(mockMonitorController.resumeMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('logsCommand', () => {
    it('should show logs with specified number of lines', async () => {
      // Setup mocks
      const mockLogViewer = (cliController as any).logViewer;

      // Execute command
      await cliController.logsCommand({ lines: '100' });

      // Verify calls
      expect(mockLogViewer.showLogs).toHaveBeenCalledWith(100, undefined);
    });

    it('should follow logs when requested', async () => {
      // Setup mocks
      const mockLogViewer = (cliController as any).logViewer;

      // Execute command
      await cliController.logsCommand({ follow: true, lines: '25' });

      // Verify calls
      expect(mockLogViewer.followLogs).toHaveBeenCalledWith(25, undefined);
    });

    it('should use default line count when not specified', async () => {
      // Setup mocks
      const mockLogViewer = (cliController as any).logViewer;

      // Execute command
      await cliController.logsCommand({});

      // Verify calls
      expect(mockLogViewer.showLogs).toHaveBeenCalledWith(50, undefined);
    });
  });

  describe('getTelegramStatusDisplay', () => {
    it('should return red X when Telegram is disabled', () => {
      const result = (cliController as any).getTelegramStatusDisplay(false);
      expect(result).toContain('✗');
    });

    it('should return green checkmark when Telegram is enabled and credentials are valid', () => {
      // Mock valid Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      const result = (cliController as any).getTelegramStatusDisplay(true);
      expect(result).toContain('✓');
    });

    it('should return warning symbol when Telegram is enabled but credentials are missing', () => {
      // Mock missing Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      const result = (cliController as any).getTelegramStatusDisplay(true);
      expect(result).toContain('⚠️');
      expect(result).toContain('credentials missing');
    });

    it('should return warning symbol when Telegram is enabled but only bot token is missing', () => {
      // Mock partially missing Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN']
      });

      const result = (cliController as any).getTelegramStatusDisplay(true);
      expect(result).toContain('⚠️');
      expect(result).toContain('credentials missing');
    });

    it('should return warning symbol when Telegram is enabled but only chat ID is missing', () => {
      // Mock partially missing Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_CHAT_ID']
      });

      const result = (cliController as any).getTelegramStatusDisplay(true);
      expect(result).toContain('⚠️');
      expect(result).toContain('credentials missing');
    });
  });

  describe('displayConfigurationSummary', () => {
    it('should display configuration summary with Telegram disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const configWithTelegramDisabled = {
        ...mockConfig,
        notificationSettings: {
          ...mockConfig.notificationSettings,
          telegram: false
        }
      };

      (cliController as any).displayConfigurationSummary(configWithTelegramDisabled);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Telegram: ✗'));
    });

    it('should display configuration summary with Telegram enabled and credentials valid', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      // Mock valid Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: true,
        missingVars: []
      });

      const configWithTelegramEnabled = {
        ...mockConfig,
        notificationSettings: {
          ...mockConfig.notificationSettings,
          telegram: true
        }
      };

      (cliController as any).displayConfigurationSummary(configWithTelegramEnabled);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Telegram: ✓'));
    });

    it('should display configuration summary with Telegram enabled but credentials missing', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      // Mock missing Telegram credentials
      EnvironmentConfigManager.validateTelegramEnvironment.mockReturnValue({
        isValid: false,
        missingVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
      });

      const configWithTelegramEnabled = {
        ...mockConfig,
        notificationSettings: {
          ...mockConfig.notificationSettings,
          telegram: true
        }
      };

      (cliController as any).displayConfigurationSummary(configWithTelegramEnabled);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Telegram: ⚠️  (credentials missing)'));
    });

    it('should display all notification settings correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const configWithAllNotifications = {
        ...mockConfig,
        notificationSettings: {
          desktop: true,
          audio: false,
          logFile: true,
          telegram: false
        }
      };

      (cliController as any).displayConfigurationSummary(configWithAllNotifications);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Desktop: ✓'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Audio: ✗'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Log File: ✓'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Telegram: ✗'));
    });

    it('should call getTelegramStatusDisplay for Telegram status', () => {
      const getTelegramStatusDisplaySpy = jest.spyOn(cliController as any, 'getTelegramStatusDisplay');
      
      const configWithTelegram = {
        ...mockConfig,
        notificationSettings: {
          ...mockConfig.notificationSettings,
          telegram: true
        }
      };

      (cliController as any).displayConfigurationSummary(configWithTelegram);

      expect(getTelegramStatusDisplaySpy).toHaveBeenCalledWith(true);
    });

    it('should display configuration summary with undefined telegram setting', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const configWithUndefinedTelegram = {
        ...mockConfig,
        notificationSettings: {
          ...mockConfig.notificationSettings,
          telegram: undefined
        }
      };

      (cliController as any).displayConfigurationSummary(configWithUndefinedTelegram);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Telegram: ✗'));
    });
  });
});