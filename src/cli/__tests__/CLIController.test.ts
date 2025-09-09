import { CLIController } from '../CLIController';
import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { MonitorConfig } from '../../models/types';

// Mock dependencies
jest.mock('../../services/MonitorController');
jest.mock('../../services/ConfigurationManager');
jest.mock('../../services/StatusLoggerService');
jest.mock('../InteractiveConfigPrompts');
jest.mock('../StatusDisplay');
jest.mock('../LogViewer');

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
    
    // Create CLI controller instance
    cliController = new CLIController();
    
    // Get mocked instances
    mockMonitorController = (cliController as any).monitorController;
    mockConfigManager = (cliController as any).configManager;
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

      // Execute command
      await cliController.startCommand({ config: customConfigPath, daemon: true });

      // Verify that a new ConfigurationManager was created with custom path
      expect(mockMonitorController.startMonitoring).toHaveBeenCalled();
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
      expect(mockLogViewer.showLogs).toHaveBeenCalledWith(100);
    });

    it('should follow logs when requested', async () => {
      // Setup mocks
      const mockLogViewer = (cliController as any).logViewer;

      // Execute command
      await cliController.logsCommand({ follow: true, lines: '25' });

      // Verify calls
      expect(mockLogViewer.followLogs).toHaveBeenCalledWith(25);
    });

    it('should use default line count when not specified', async () => {
      // Setup mocks
      const mockLogViewer = (cliController as any).logViewer;

      // Execute command
      await cliController.logsCommand({});

      // Verify calls
      expect(mockLogViewer.showLogs).toHaveBeenCalledWith(50);
    });
  });
});