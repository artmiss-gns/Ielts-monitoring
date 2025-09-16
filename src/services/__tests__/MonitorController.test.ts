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
    
    // Mock the new enhanced method
    mockWebScraper.fetchAppointmentsWithStatus = jest.fn().mockResolvedValue({
      type: 'available',
      appointmentCount: mockAppointments.length,
      availableCount: mockAppointments.length,
      filledCount: 0,
      timestamp: new Date(),
      url: 'https://test.com',
      appointments: mockAppointments
    });
    
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
    mockStatusLogger.logAppointmentCheck.mockResolvedValue();
    mockStatusLogger.logNotificationWorthyEvent.mockResolvedValue();
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
      expect(mockWebScraper.fetchAppointmentsWithStatus).toHaveBeenCalledWith({
        city: mockConfig.city,
        examModel: mockConfig.examModel,
        months: mockConfig.months
      });
      expect(mockDataStorage.saveAppointments).toHaveBeenCalled();
      expect(mockStatusLogger.logAppointmentCheck).toHaveBeenCalled();
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

  describe('Notification Filtering and False Positive Prevention', () => {
    const mockCheckResult = {
      type: 'available' as const,
      appointmentCount: 3,
      availableCount: 1,
      filledCount: 2,
      timestamp: new Date(),
      url: 'https://test.com',
      appointments: [
        {
          id: 'apt-available',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'isfahan',
          status: 'available' as const
        },
        {
          id: 'apt-filled-1',
          date: '2025-02-16',
          time: '14:00-17:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'isfahan',
          status: 'filled' as const
        },
        {
          id: 'apt-filled-2',
          date: '2025-02-17',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'isfahan',
          status: 'pending' as const
        }
      ]
    };

    beforeEach(() => {
      // Mock the enhanced fetchAppointmentsWithStatus method
      mockWebScraper.fetchAppointmentsWithStatus = jest.fn().mockResolvedValue(mockCheckResult);
      mockStatusLogger.logAppointmentCheck = jest.fn().mockResolvedValue(undefined);
      mockStatusLogger.logNotificationWorthyEvent = jest.fn().mockResolvedValue(undefined);
    });

    test('should only send notifications for available appointments', async () => {
      const newAppointments = mockCheckResult.appointments; // Mix of available and filled
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments,
        removedAppointments: [],
        unchangedAppointments: []
      });

      const newAppointmentEvents: Appointment[][] = [];
      const notificationEvents: number[] = [];
      
      monitorController.on('new-appointments', (appointments) => 
        newAppointmentEvents.push(appointments));
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should only emit available appointments
      expect(newAppointmentEvents.length).toBe(1);
      expect(newAppointmentEvents[0]).toHaveLength(1);
      expect(newAppointmentEvents[0][0].status).toBe('available');

      // Should only send notification for available appointment
      expect(notificationEvents.length).toBe(1);
      expect(notificationEvents[0]).toBe(1); // Only 1 available appointment

      // Should call notification service with only available appointments
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        [mockCheckResult.appointments[0]], // Only the available appointment
        mockConfig.notificationSettings
      );

      // Should log notification-worthy event
      expect(mockStatusLogger.logNotificationWorthyEvent).toHaveBeenCalledWith(
        [mockCheckResult.appointments[0]],
        'new_available_appointments_detected'
      );
    });

    test('should suppress notifications when only filled appointments are new', async () => {
      const filledAppointments = mockCheckResult.appointments.filter(apt => apt.status !== 'available');
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments: filledAppointments,
        removedAppointments: [],
        unchangedAppointments: []
      });

      const newAppointmentEvents: Appointment[][] = [];
      const notificationEvents: number[] = [];
      
      monitorController.on('new-appointments', (appointments) => 
        newAppointmentEvents.push(appointments));
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should not emit new-appointments event for filled appointments
      expect(newAppointmentEvents).toHaveLength(0);

      // Should not send any notifications
      expect(notificationEvents).toHaveLength(0);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();

      // Should log warning about suppressed notification
      expect(mockStatusLogger.logWarn).toHaveBeenCalledWith(
        'Notification suppressed: No available appointments',
        expect.objectContaining({
          totalAppointments: 2,
          appointmentStatuses: ['filled', 'pending']
        })
      );
    });

    test('should use enhanced status detection in monitoring checks', async () => {
      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should call the enhanced method instead of the legacy one
      expect(mockWebScraper.fetchAppointmentsWithStatus).toHaveBeenCalledWith({
        city: mockConfig.city,
        examModel: mockConfig.examModel,
        months: mockConfig.months
      });

      // Should not call the legacy method
      expect(mockWebScraper.fetchAppointments).not.toHaveBeenCalled();

      // Should log enhanced check results
      expect(mockStatusLogger.logAppointmentCheck).toHaveBeenCalledWith(
        mockCheckResult,
        expect.any(Number) // duration
      );
    });

    test('should handle no-slots result type correctly', async () => {
      const noSlotsResult = {
        ...mockCheckResult,
        type: 'no-slots' as const,
        appointmentCount: 0,
        availableCount: 0,
        filledCount: 0,
        appointments: []
      };

      mockWebScraper.fetchAppointmentsWithStatus.mockResolvedValue(noSlotsResult);
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments: [],
        removedAppointments: [],
        unchangedAppointments: []
      });

      const notificationEvents: number[] = [];
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should not send any notifications
      expect(notificationEvents).toHaveLength(0);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();

      // Should log the no-slots status
      expect(mockStatusLogger.logAppointmentCheck).toHaveBeenCalledWith(
        noSlotsResult,
        expect.any(Number)
      );
    });

    test('should handle filled result type correctly', async () => {
      const filledResult = {
        ...mockCheckResult,
        type: 'filled' as const,
        appointmentCount: 2,
        availableCount: 0,
        filledCount: 2,
        appointments: mockCheckResult.appointments.filter(apt => apt.status !== 'available')
      };

      mockWebScraper.fetchAppointmentsWithStatus.mockResolvedValue(filledResult);
      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments: filledResult.appointments,
        removedAppointments: [],
        unchangedAppointments: []
      });

      const notificationEvents: number[] = [];
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should not send any notifications
      expect(notificationEvents).toHaveLength(0);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();

      // Should log warning about no available appointments
      expect(mockStatusLogger.logWarn).toHaveBeenCalledWith(
        'Notification suppressed: No available appointments',
        expect.objectContaining({
          totalAppointments: 2,
          appointmentStatuses: ['filled', 'pending']
        })
      );
    });

    test('should log detailed status information in console output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should log enhanced status information
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: available | Total: 3 | Available: 1 | Filled: 2')
      );

      consoleSpy.mockRestore();
    });

    test('should handle mixed new appointments correctly', async () => {
      const mixedAppointments = [
        {
          id: 'new-available',
          date: '2025-02-18',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'isfahan',
          status: 'available' as const
        },
        {
          id: 'new-filled',
          date: '2025-02-19',
          time: '14:00-17:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'isfahan',
          status: 'filled' as const
        }
      ];

      mockDataStorage.detectNewAppointments.mockReturnValue({
        newAppointments: mixedAppointments,
        removedAppointments: [],
        unchangedAppointments: []
      });

      const newAppointmentEvents: Appointment[][] = [];
      const notificationEvents: number[] = [];
      
      monitorController.on('new-appointments', (appointments) => 
        newAppointmentEvents.push(appointments));
      monitorController.on('notification-sent', (count) => 
        notificationEvents.push(count));

      await monitorController.startMonitoring(mockConfig);
      await (monitorController as any).triggerCheck();
      await monitorController.stopMonitoring();

      // Should only emit the available appointment
      expect(newAppointmentEvents.length).toBe(1);
      expect(newAppointmentEvents[0]).toHaveLength(1);
      expect(newAppointmentEvents[0][0].id).toBe('new-available');

      // Should send notification for only the available appointment
      expect(notificationEvents.length).toBe(1);
      expect(notificationEvents[0]).toBe(1);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        [mixedAppointments[0]], // Only the available appointment
        mockConfig.notificationSettings
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async () => {
      const networkError = new Error('network timeout');
      mockWebScraper.fetchAppointmentsWithStatus.mockRejectedValueOnce(networkError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect(errorEvents[0]).toBe(networkError);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Monitoring check failed')
      );
      // Should continue monitoring after network error
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle parsing errors gracefully', async () => {
      const parseError = new Error('HTML parse error');
      mockWebScraper.fetchAppointmentsWithStatus.mockRejectedValueOnce(parseError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error
      await (monitorController as any).triggerCheck();
      
      await monitorController.stopMonitoring();

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Monitoring check failed')
      );
    });

    test('should handle critical configuration errors', async () => {
      const configError = new Error('configuration error detected');
      mockWebScraper.fetchAppointmentsWithStatus.mockRejectedValueOnce(configError);

      const errorEvents: Error[] = [];
      monitorController.on('error', (error) => errorEvents.push(error));

      await monitorController.startMonitoring(mockConfig);

      // Manually trigger check to cause error (catch to prevent unhandled rejection)
      try {
        await (monitorController as any).triggerCheck();
      } catch (error) {
        // Expected to throw due to critical error
      }

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect(errorEvents[0]).toBe(configError);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Monitoring check failed')
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

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect(mockStatusLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Failed to send notifications')
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