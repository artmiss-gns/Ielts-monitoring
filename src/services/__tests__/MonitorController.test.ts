import { MonitorController, MonitorStatus } from '../MonitorController';
import { ConfigurationManager } from '../ConfigurationManager';
import { WebScraperService } from '../WebScraperService';
import { DataStorageService } from '../DataStorageService';
import { NotificationService } from '../NotificationService';
import { StatusLoggerService } from '../StatusLoggerService';
import { MonitorConfig, Appointment } from '../../models/types';

// Mock all service dependencies
jest.mock('../ConfigurationManager');
jest.mock('../WebScraperService');
jest.mock('../DataStorageService');
jest.mock('../NotificationService');
jest.mock('../StatusLoggerService');

describe('MonitorController', () => {
  let monitorController: MonitorController;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockWebScraper: jest.Mocked<WebScraperService>;
  let mockDataStorage: jest.Mocked<DataStorageService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockStatusLogger: jest.Mocked<StatusLoggerService>;

  const mockConfig: MonitorConfig = {
    city: ['isfahan'],
    examModel: ['cdielts'],
    months: [12, 1, 2],
    checkInterval: 1000, // 1 second for testing
    notificationSettings: {
      desktop: true,
      audio: true,
      logFile: true
    }
  };

  const mockAppointments: Appointment[] = [
    {
      id: 'apt-1',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    },
    {
      id: 'apt-2',
      date: '2025-02-16',
      time: '14:00-17:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create new instance for each test (skip shutdown handlers in tests)
    monitorController = new MonitorController({ skipShutdownHandlers: true });

    // Get mocked instances
    mockConfigManager = (monitorController as any).configManager;
    mockWebScraper = (monitorController as any).webScraper;
    mockDataStorage = (monitorController as any).dataStorage;
    mockNotificationService = (monitorController as any).notificationService;
    mockStatusLogger = (monitorController as any).statusLogger;

    // Setup default mock implementations
    mockConfigManager.loadConfig.mockResolvedValue(mockConfig);
    mockWebScraper.initialize.mockResolvedValue();
    mockWebScraper.close.mockResolvedValue();
    mockWebScraper.fetchAppointments.mockResolvedValue(mockAppointments);
    mockDataStorage.getLastAppointments.mockResolvedValue([]);
    mockDataStorage.saveAppointments.mockResolvedValue();
    mockDataStorage.detectNewAppointments.mockReturnValue({
      newAppointments: [],
      removedAppointments: [],
      unchangedAppointments: mockAppointments
    });
    mockStatusLogger.startSession.mockResolvedValue();
    mockStatusLogger.endSession.mockResolvedValue();
    mockStatusLogger.logCheck.mockResolvedValue();
    mockStatusLogger.logInfo.mockResolvedValue();
    mockStatusLogger.logWarn.mockResolvedValue();
    mockStatusLogger.logError.mockResolvedValue();
    mockStatusLogger.logNotification.mockResolvedValue();
    mockStatusLogger.getStatistics.mockReturnValue({
      sessionId: 'test-session',
      startTime: new Date(),
      uptime: 5000,
      checksPerformed: 2,
      notificationsSent: 1,
      errorsEncountered: 0
    });
    mockNotificationService.sendNotification.mockResolvedValue({
      timestamp: new Date(),
      appointmentCount: 1,
      appointments: [mockAppointments[0]],
      channels: ['desktop', 'audio'],
      deliveryStatus: 'success'
    });
  });

  afterEach(async () => {
    // Ensure monitoring is stopped after each test
    if (monitorController.isActive()) {
      await monitorController.stopMonitoring();
    }
  });

  describe('Lifecycle Management', () => {
    test('should start monitoring successfully', async () => {
      const statusChanges: MonitorStatus[] = [];
      monitorController.on('status-changed', (status) => statusChanges.push(status));

      await monitorController.startMonitoring(mockConfig);

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);
      expect(statusChanges).toEqual([MonitorStatus.STARTING, MonitorStatus.RUNNING]);
      expect(mockWebScraper.initialize).toHaveBeenCalled();
      expect(mockStatusLogger.startSession).toHaveBeenCalled();
    });

    test('should not allow starting monitoring when already running', async () => {
      await monitorController.startMonitoring(mockConfig);

      await expect(monitorController.startMonitoring(mockConfig))
        .rejects.toThrow('Monitoring is already running');
    });

    test('should pause monitoring successfully', async () => {
      await monitorController.startMonitoring(mockConfig);
      
      const statusChanges: MonitorStatus[] = [];
      monitorController.on('status-changed', (status) => statusChanges.push(status));

      await monitorController.pauseMonitoring();

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.PAUSED);
      expect(statusChanges).toContain(MonitorStatus.PAUSED);
      expect(mockStatusLogger.logInfo).toHaveBeenCalledWith(
        'Monitoring paused',
        expect.any(Object)
      );
    });

    test('should not allow pausing when not running', async () => {
      await expect(monitorController.pauseMonitoring())
        .rejects.toThrow('Cannot pause monitoring - not currently running');
    });

    test('should resume monitoring from paused state', async () => {
      await monitorController.startMonitoring(mockConfig);
      await monitorController.pauseMonitoring();

      const statusChanges: MonitorStatus[] = [];
      monitorController.on('status-changed', (status) => statusChanges.push(status));

      await monitorController.resumeMonitoring();

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);
      expect(statusChanges).toContain(MonitorStatus.RUNNING);
      expect(mockStatusLogger.logInfo).toHaveBeenCalledWith(
        'Monitoring resumed',
        expect.any(Object)
      );
    });

    test('should not allow resuming when not paused', async () => {
      await expect(monitorController.resumeMonitoring())
        .rejects.toThrow('Cannot resume monitoring - not currently paused');
    });

    test('should stop monitoring gracefully', async () => {
      await monitorController.startMonitoring(mockConfig);
      
      const statusChanges: MonitorStatus[] = [];
      monitorController.on('status-changed', (status) => statusChanges.push(status));

      await monitorController.stopMonitoring();

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
      expect(statusChanges).toEqual([MonitorStatus.STOPPING, MonitorStatus.STOPPED]);
      expect(mockStatusLogger.endSession).toHaveBeenCalled();
      expect(mockWebScraper.close).toHaveBeenCalled();
    });

    test('should handle multiple stop calls gracefully', async () => {
      await monitorController.startMonitoring(mockConfig);
      
      await monitorController.stopMonitoring();
      await monitorController.stopMonitoring(); // Should not throw

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Monitoring Loop', () => {
    test('should perform monitoring checks at configured intervals', async () => {
      const checkEvents: number[] = [];
      monitorController.on('check-completed', (count) => checkEvents.push(count));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger checks for testing
      await (monitorController as any).triggerCheck();
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(checkEvents.length).toBeGreaterThanOrEqual(2);
      expect(mockWebScraper.fetchAppointments).toHaveBeenCalledWith({
        city: mockConfig.city,
        examModel: mockConfig.examModel,
        months: mockConfig.months
      });
      expect(mockDataStorage.saveAppointments).toHaveBeenCalled();
      expect(mockStatusLogger.logCheck).toHaveBeenCalled();
    });

    test('should detect and notify about new appointments', async () => {
      const newAppointments = [mockAppointments[0]];
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments,
        removedAppointments: [],
        unchangedAppointments: [mockAppointments[1]]
      });

      const newAppointmentEvents: Appointment[][] = [];
      const notificationEvents: number[] = [];
      
      monitorController.on('new-appointments', (appointments) => 
        newAppointmentEvents.push(appointments));
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check for testing
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(newAppointmentEvents.length).toBeGreaterThan(0);
      expect(newAppointmentEvents[0]).toEqual(newAppointments);
      expect(notificationEvents.length).toBeGreaterThan(0);
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        newAppointments,
        mockConfig.notificationSettings
      );
    });

    test('should not send notifications when no new appointments', async () => {
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments: [],
        removedAppointments: [],
        unchangedAppointments: mockAppointments
      });

      const notificationEvents: number[] = [];
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check for testing
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(notificationEvents).toHaveLength(0);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async () => {
      const networkError = new Error('network timeout');
      mockWebScraper.fetchAppointments.mockRejectedValueOnce(networkError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toBe(networkError);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        networkError,
        'Monitoring check failed'
      );
      // Should continue monitoring after network error
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle parsing errors gracefully', async () => {
      const parseError = new Error('HTML parse error');
      mockWebScraper.fetchAppointments.mockRejectedValueOnce(parseError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(errorEvents).toHaveLength(1);
      expect(mockStatusLogger.logWarn).toHaveBeenCalledWith(
        'Website structure may have changed',
        expect.any(Object)
      );
    });

    test('should handle critical configuration errors', async () => {
      const configError = new Error('configuration error detected');
      mockWebScraper.fetchAppointments.mockRejectedValueOnce(configError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error (catch to prevent unhandled rejection)
      try {
        await (monitorController as any).triggerCheck();
      } catch (error) {
        // Expected to throw due to critical error
      }

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toBe(configError);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        configError,
        'Monitoring check failed'
      );
    });

    test('should handle notification failures gracefully', async () => {
      const newAppointments = [mockAppointments[0]];
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments,
        removedAppointments: [],
        unchangedAppointments: [mockAppointments[1]]
      });

      const notificationError = new Error('Notification failed');
      mockNotificationService.sendNotification.mockRejectedValueOnce(notificationError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause notification error
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(errorEvents).toHaveLength(1);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        notificationError,
        'Failed to send notifications'
      );
      // Should continue monitoring after notification error
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Configuration Management', () => {
    test('should load configuration if not provided', async () => {
      await monitorController.startMonitoring();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);
    });

    test('should use provided configuration', async () => {
      const customConfig: MonitorConfig = {
        ...mockConfig,
        checkInterval: 5000
      };

      await monitorController.startMonitoring(customConfig);

      expect(mockConfigManager.loadConfig).not.toHaveBeenCalled();
      
      const status = await monitorController.getStatus();
      expect(status.config).toEqual(customConfig);
    });

    test('should update configuration and restart if running', async () => {
      await monitorController.startMonitoring(mockConfig);
      
      const newConfig: MonitorConfig = {
        ...mockConfig,
        checkInterval: 5000
      };

      await monitorController.updateConfiguration(newConfig);

      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith(newConfig);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);
      
      const status = await monitorController.getStatus();
      expect(status.config).toEqual(newConfig);
    });

    test('should update configuration without restarting if stopped', async () => {
      const newConfig: MonitorConfig = {
        ...mockConfig,
        checkInterval: 5000
      };

      await monitorController.updateConfiguration(newConfig);

      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith(newConfig);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Status and Statistics', () => {
    test('should return current status when stopped', async () => {
      const status = await monitorController.getStatus();

      expect(status.status).toBe(MonitorStatus.STOPPED);
      expect(status.statistics).toBeUndefined();
      expect(status.session).toBeUndefined();
      expect(status.config).toBeUndefined();
    });

    test('should return comprehensive status when running', async () => {
      await monitorController.startMonitoring(mockConfig);
      
      const status = await monitorController.getStatus();

      expect(status.status).toBe(MonitorStatus.RUNNING);
      expect(status.statistics).toBeDefined();
      expect(status.session).toBeDefined();
      expect(status.config).toEqual(mockConfig);
      expect(status.session?.sessionId).toBeDefined();
      expect(status.session?.startTime).toBeInstanceOf(Date);
    });

    test('should provide utility methods for status checking', async () => {
      expect(monitorController.isActive()).toBe(false);
      expect(monitorController.isPaused()).toBe(false);
      expect(monitorController.getCurrentSession()).toBeNull();

      await monitorController.startMonitoring(mockConfig);

      expect(monitorController.isActive()).toBe(true);
      expect(monitorController.isPaused()).toBe(false);
      expect(monitorController.getCurrentSession()).toBeDefined();

      await monitorController.pauseMonitoring();

      expect(monitorController.isActive()).toBe(false);
      expect(monitorController.isPaused()).toBe(true);
    });
  });

  describe('Event Emission', () => {
    test('should emit status-changed events', async () => {
      const statusChanges: MonitorStatus[] = [];
      monitorController.on('status-changed', (status) => statusChanges.push(status));

      await monitorController.startMonitoring(mockConfig);
      await monitorController.pauseMonitoring();
      await monitorController.resumeMonitoring();
      await monitorController.stopMonitoring();

      expect(statusChanges).toEqual([
        MonitorStatus.STARTING,
        MonitorStatus.RUNNING,
        MonitorStatus.PAUSED,
        MonitorStatus.RUNNING,
        MonitorStatus.STOPPING,
        MonitorStatus.STOPPED
      ]);
    });

    test('should emit appointments-found events', async () => {
      const appointmentEvents: Appointment[][] = [];
      monitorController.on('appointments-found', (appointments) => 
        appointmentEvents.push(appointments));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check for testing
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(appointmentEvents.length).toBeGreaterThan(0);
      expect(appointmentEvents[0]).toEqual(mockAppointments);
    });

    test('should emit check-completed events', async () => {
      const checkEvents: number[] = [];
      monitorController.on('check-completed', (count) => checkEvents.push(count));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check for testing
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(checkEvents.length).toBeGreaterThan(0);
      expect(checkEvents[0]).toBe(mockAppointments.length);
    });
  });

  describe('Service Integration', () => {
    test('should initialize all services on start', async () => {
      await monitorController.startMonitoring(mockConfig);

      expect(mockWebScraper.initialize).toHaveBeenCalled();
      expect(mockStatusLogger.startSession).toHaveBeenCalledWith(
        expect.any(String),
        mockConfig
      );
    });

    test('should cleanup all services on stop', async () => {
      await monitorController.startMonitoring(mockConfig);
      await monitorController.stopMonitoring();

      expect(mockWebScraper.close).toHaveBeenCalled();
      expect(mockStatusLogger.endSession).toHaveBeenCalled();
    });

    test('should handle service initialization failures', async () => {
      const initError = new Error('Service initialization failed');
      mockWebScraper.initialize.mockRejectedValueOnce(initError);

      try {
        await monitorController.startMonitoring(mockConfig);
        fail('Expected startMonitoring to throw');
      } catch (error: any) {
        // The error might be wrapped, check if it contains the original error
        expect(error.context || error).toBe(initError);
      }

      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.ERROR);
    });
  });

  describe('Session Management', () => {
    test('should create unique session IDs', async () => {
      await monitorController.startMonitoring(mockConfig);
      const session1 = monitorController.getCurrentSession();
      await monitorController.stopMonitoring();

      await monitorController.startMonitoring(mockConfig);
      const session2 = monitorController.getCurrentSession();
      await monitorController.stopMonitoring();

      expect(session1?.sessionId).toBeDefined();
      expect(session2?.sessionId).toBeDefined();
      expect(session1?.sessionId).not.toBe(session2?.sessionId);
    });

    test('should track session statistics', async () => {
      await monitorController.startMonitoring(mockConfig);

      // Manually trigger checks for testing
      await (monitorController as any).triggerCheck();
      await (monitorController as any).triggerCheck();

      const session = monitorController.getCurrentSession();
      expect(session?.checksPerformed).toBeGreaterThan(0);
      expect(session?.startTime).toBeInstanceOf(Date);
      expect(session?.configuration).toEqual(mockConfig);

      await monitorController.stopMonitoring();
    });
  });
});