import { NotificationService } from '../NotificationService';
import { Appointment, TelegramConfig } from '../../models/types';

// Mock node-notifier to prevent actual system notifications during tests
jest.mock('node-notifier', () => ({
  notify: jest.fn((_options, callback) => {
    // Simulate successful notification without triggering real system notifications
    if (callback) {
      process.nextTick(() => callback(null, 'success'));
    }
  })
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  remove: jest.fn().mockResolvedValue(undefined)
}));

// Mock TelegramNotifier
jest.mock('../TelegramNotifier', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    sendNotification: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
    isConfigured: jest.fn().mockReturnValue(true)
  }))
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let notificationServiceWithTelegram: NotificationService;
  let mockNotifier: any;
  let mockFs: any;
  let mockTelegramNotifier: any;

  const mockTelegramConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: '@test_channel',
    messageFormat: 'detailed',
    enablePreview: false,
    isChannel: true
  };

  const mockAppointments: Appointment[] = [
    {
      id: 'apt-available-1',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    },
    {
      id: 'apt-available-2',
      date: '2025-02-16',
      time: '14:00-17:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    }
  ];

  const mockFilledAppointments: Appointment[] = [
    {
      id: 'apt-filled-1',
      date: '2025-02-17',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'filled'
    },
    {
      id: 'apt-pending-1',
      date: '2025-02-18',
      time: '14:00-17:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'pending'
    }
  ];

  const mockMixedAppointments: Appointment[] = [
    ...mockAppointments,
    ...mockFilledAppointments
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockNotifier = require('node-notifier');
    mockFs = require('fs-extra');
    
    // Setup TelegramNotifier mock
    const { TelegramNotifier } = require('../TelegramNotifier');
    mockTelegramNotifier = {
      sendNotification: jest.fn().mockResolvedValue(true),
      testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
      isConfigured: jest.fn().mockReturnValue(true)
    };
    TelegramNotifier.mockImplementation(() => mockTelegramNotifier);

    notificationService = new NotificationService('test-logs');
    notificationServiceWithTelegram = new NotificationService('test-logs', mockTelegramConfig);
  });

  describe('Notification Filtering', () => {
    test('should send notifications for available appointments only', async () => {
      const channels = { desktop: true, audio: true, logFile: true };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      expect(result.appointmentCount).toBe(2);
      expect(result.appointments).toEqual(mockAppointments);
      expect(result.channels).toContain('desktop');
      expect(result.channels).toContain('audio');
      expect(result.channels).toContain('logFile');
      expect(result.deliveryStatus).toBe('success');

      // Should call desktop notification with available appointments
      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IELTS Appointments Available for Booking!',
          message: expect.stringContaining('AVAILABLE')
        }),
        expect.any(Function)
      );
    });

    test('should reject notifications when no available appointments', async () => {
      const channels = { desktop: true, audio: false, logFile: false };
      
      await expect(notificationService.sendNotification(mockFilledAppointments, channels))
        .rejects.toThrow('No available appointments to notify about');

      expect(mockNotifier.notify).not.toHaveBeenCalled();
    });

    test('should filter mixed appointments to only available ones', async () => {
      const channels = { desktop: true, audio: false, logFile: true };
      
      const result = await notificationService.sendNotification(mockMixedAppointments, channels);

      expect(result.appointmentCount).toBe(4); // Total appointments passed in
      expect(result.appointments).toEqual(mockMixedAppointments);
      expect(result.deliveryStatus).toBe('success');

      // Should only notify about available appointments
      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IELTS Appointments Available for Booking!',
          message: expect.stringContaining('AVAILABLE')
        }),
        expect.any(Function)
      );
    });

    test('should include status information in notification messages', async () => {
      const channels = { desktop: true, audio: false, logFile: false };
      
      await notificationService.sendNotification([mockAppointments[0]], channels);

      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IELTS Appointments Available for Booking!',
          message: expect.stringContaining('AVAILABLE')
        }),
        expect.any(Function)
      );
    });

    test('should handle single available appointment correctly', async () => {
      const channels = { desktop: true, audio: false, logFile: false };
      
      await notificationService.sendNotification([mockAppointments[0]], channels);

      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IELTS Appointments Available for Booking!',
          message: expect.stringContaining('2025-02-15 at 09:00-12:00')
        }),
        expect.any(Function)
      );
    });

    test('should handle multiple available appointments correctly', async () => {
      const channels = { desktop: true, audio: false, logFile: false };
      
      await notificationService.sendNotification(mockAppointments, channels);

      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'IELTS Appointments Available for Booking!',
          message: expect.stringContaining('2025-02-15 at 09:00-12:00 (Isfahan Center) - AVAILABLE')
        }),
        expect.any(Function)
      );
    });
  });

  describe('Enhanced Logging', () => {
    test('should log available appointments with status information', async () => {
      const channels = { desktop: false, audio: false, logFile: true };
      
      await notificationService.sendNotification(mockAppointments, channels);

      expect(mockFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('notifications.log'),
        expect.stringContaining('NEW_AVAILABLE_APPOINTMENTS_FOUND'),
        'utf8'
      );

      // Check the log entry structure
      const logCall = (mockFs.appendFile as any).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.event).toBe('NEW_AVAILABLE_APPOINTMENTS_FOUND');
      expect(logEntry.count).toBe(2); // Available appointments count
      expect(logEntry.totalCount).toBe(2); // Total appointments count
      expect(logEntry.appointments).toHaveLength(2);
      expect(logEntry.appointments[0].status).toBe('available');
    });

    test('should log only available appointments even with mixed input', async () => {
      const channels = { desktop: false, audio: false, logFile: true };
      
      await notificationService.sendNotification(mockMixedAppointments, channels);

      const logCall = (mockFs.appendFile as any).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.event).toBe('NEW_AVAILABLE_APPOINTMENTS_FOUND');
      expect(logEntry.count).toBe(2); // Only available appointments
      expect(logEntry.totalCount).toBe(4); // Total appointments passed in
      expect(logEntry.appointments).toHaveLength(2);
      expect(logEntry.appointments.every((apt: any) => apt.status === 'available')).toBe(true);
    });
  });

  describe('Retry Logic with Filtering', () => {
    test('should retry desktop notifications for available appointments', async () => {
      // Mock first call to fail, second to succeed
      mockNotifier.notify
        .mockImplementationOnce((_options: any, callback: any) => {
          setTimeout(() => callback(new Error('Desktop notification failed')), 10);
        })
        .mockImplementationOnce((_options: any, callback: any) => {
          setTimeout(() => callback(null, 'success'), 10);
        });

      const channels = { desktop: true, audio: false, logFile: false };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      expect(result.deliveryStatus).toBe('success');
      expect(result.channels).toContain('desktop');
      expect(mockNotifier.notify).toHaveBeenCalledTimes(2);
    });

    test('should fail gracefully when all retries exhausted for available appointments', async () => {
      // Mock all calls to fail
      mockNotifier.notify.mockImplementation((_options: any, callback: any) => {
        setTimeout(() => callback(new Error('Desktop notification failed')), 10);
      });

      const channels = { desktop: true, audio: false, logFile: false };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      expect(result.deliveryStatus).toBe('failed');
      expect(result.channels).not.toContain('desktop');
      expect(mockNotifier.notify).toHaveBeenCalledTimes(3); // 3 retries
    });
  });

  describe('Multi-channel Notifications with Filtering', () => {
    test('should handle partial success with available appointments', async () => {
      // Mock desktop to fail, others to succeed
      mockNotifier.notify.mockImplementation((_options: any, callback: any) => {
        setTimeout(() => callback(new Error('Desktop failed')), 10);
      });

      const channels = { desktop: true, audio: true, logFile: true };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      expect(result.deliveryStatus).toBe('partial');
      expect(result.channels).not.toContain('desktop');
      expect(result.channels).toContain('audio');
      expect(result.channels).toContain('logFile');
    });

    test('should handle all channels success with available appointments', async () => {
      const channels = { desktop: true, audio: true, logFile: true };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      // Check that at least some channels succeeded
      expect(result.deliveryStatus).toMatch(/success|partial/);
      expect(result.channels.length).toBeGreaterThan(0);
    });
  });

  describe('Notification History', () => {
    test('should retrieve notification history with enhanced log format', async () => {
      // Mock log file content with new format
      const mockLogContent = [
        JSON.stringify({
          timestamp: '2025-01-15T10:00:00.000Z',
          event: 'NEW_APPOINTMENTS_FOUND',
          count: 2,
          appointments: mockAppointments.map(apt => ({
            id: apt.id,
            date: apt.date,
            time: apt.time,
            location: apt.location,
            examType: apt.examType,
            city: apt.city,
            status: apt.status
          }))
        }),
        JSON.stringify({
          timestamp: '2025-01-15T11:00:00.000Z',
          event: 'NEW_APPOINTMENTS_FOUND',
          count: 1,
          appointments: [mockAppointments[0]]
        })
      ].join('\n');

      mockFs.pathExists.mockResolvedValueOnce(true);
      mockFs.readFile.mockResolvedValueOnce(mockLogContent);

      const history = await notificationService.getNotificationHistory();

      expect(history).toHaveLength(2);
      expect(history[0].appointmentCount).toBe(1); // Newest first (11:00)
      expect(history[1].appointmentCount).toBe(2); // Older second (10:00)
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty available appointments gracefully', async () => {
      const channels = { desktop: true, audio: false, logFile: false };
      
      await expect(notificationService.sendNotification([], channels))
        .rejects.toThrow('No available appointments to notify about');
    });

    test('should handle appointments with undefined status', async () => {
      const appointmentsWithUndefinedStatus = [
        {
          ...mockAppointments[0],
          status: undefined as any
        }
      ];

      const channels = { desktop: true, audio: false, logFile: false };
      
      await expect(notificationService.sendNotification(appointmentsWithUndefinedStatus, channels))
        .rejects.toThrow('No available appointments to notify about');
    });
  });

  describe('Telegram Integration', () => {
    test('should send Telegram notifications when configured', async () => {
      const channels = { desktop: false, audio: false, logFile: false, telegram: true };
      
      const result = await notificationServiceWithTelegram.sendNotification(mockAppointments, channels);

      expect(result.deliveryStatus).toBe('success');
      expect(result.channels).toContain('telegram');
      expect(mockTelegramNotifier.sendNotification).toHaveBeenCalledWith(mockAppointments);
    });

    test('should handle Telegram notification failures gracefully', async () => {
      // Create a new service instance with failing Telegram mock
      const failingTelegramMock = {
        sendNotification: jest.fn().mockResolvedValue(false),
        testConnection: jest.fn().mockResolvedValue({ success: false, message: 'Failed' }),
        isConfigured: jest.fn().mockReturnValue(true)
      };
      const { TelegramNotifier } = require('../TelegramNotifier');
      TelegramNotifier.mockImplementationOnce(() => failingTelegramMock);
      
      const failingService = new NotificationService('test-logs', mockTelegramConfig);
      const channels = { desktop: false, audio: false, logFile: true, telegram: true };
      
      const result = await failingService.sendNotification(mockAppointments, channels);

      expect(result.deliveryStatus).toBe('partial');
      expect(result.channels).not.toContain('telegram');
      expect(result.channels).toContain('logFile');
    });

    test('should skip Telegram when not configured', async () => {
      const channels = { desktop: false, audio: false, logFile: true, telegram: true };
      
      const result = await notificationService.sendNotification(mockAppointments, channels);

      expect(result.channels).not.toContain('telegram');
      expect(result.channels).toContain('logFile');
    });

    test('should configure Telegram after initialization', () => {
      notificationService.configureTelegram(mockTelegramConfig);
      expect(notificationService.isTelegramConfigured()).toBe(true);
    });

    test('should test Telegram connection', async () => {
      const result = await notificationServiceWithTelegram.testTelegramConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected');
      expect(mockTelegramNotifier.testConnection).toHaveBeenCalled();
    });

    test('should handle Telegram test when not configured', async () => {
      const result = await notificationService.testTelegramConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Telegram notifier not configured');
    });

    test('should support multi-channel notifications with Telegram', async () => {
      const channels = { desktop: true, audio: true, logFile: true, telegram: true };
      
      const result = await notificationServiceWithTelegram.sendNotification(mockAppointments, channels);

      expect(['success', 'partial']).toContain(result.deliveryStatus);
      expect(result.channels.length).toBeGreaterThan(0);
      expect(result.channels).toContain('telegram');
    });
  });
});