import { StatusLoggerService, MonitoringStatistics } from '../StatusLoggerService';
import { NotificationRecord, Appointment, CheckResult } from '../../models/types';

// Mock fs-extra completely
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  writeJson: jest.fn().mockResolvedValue(undefined),
  readJson: jest.fn().mockResolvedValue([]),
  pathExists: jest.fn().mockResolvedValue(false),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ size: 500 }),
  statSync: jest.fn().mockReturnValue({ mtime: new Date(), size: 500 }),
  remove: jest.fn().mockResolvedValue(undefined),
  move: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('')
}));

describe('StatusLoggerService', () => {
  let service: StatusLoggerService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new StatusLoggerService({
      logDirectory: '/test-logs',
      maxLogFileSize: 1024,
      maxLogFiles: 3,
      logLevel: 'info',
      enableDetailedAppointmentLogging: true
    });
  });

  describe('Session Management', () => {
    it('should start a new monitoring session', async () => {
      const sessionId = 'test-session-1';
      const config = { city: ['London'], examModel: ['Academic'] };

      await service.startSession(sessionId, config);

      const stats = service.getStatistics();
      expect(stats).toBeTruthy();
      expect(stats!.sessionId).toBe(sessionId);
      expect(stats!.checksPerformed).toBe(0);
      expect(stats!.notificationsSent).toBe(0);
      expect(stats!.errorsEncountered).toBe(0);
    });

    it('should end a monitoring session', async () => {
      const sessionId = 'test-session-2';
      await service.startSession(sessionId, {});

      await service.endSession();

      const stats = service.getStatistics();
      expect(stats).toBeNull();
    });

    it('should handle ending session when no session is active', async () => {
      await expect(service.endSession()).resolves.not.toThrow();
    });
  });

  describe('Logging Operations', () => {
    beforeEach(async () => {
      await service.startSession('test-session', {});
    });

    it('should log monitoring checks', async () => {
      await service.logCheck(5);
      await service.logCheck(3);

      const stats = service.getStatistics();
      expect(stats!.checksPerformed).toBe(2);
      const fs = require('fs-extra');
      expect(fs.appendFile).toHaveBeenCalledTimes(3); // start + 2 checks
    });

    it('should throw error when logging check without active session', async () => {
      await service.endSession();

      await expect(service.logCheck(5)).rejects.toThrow('No active monitoring session');
    });

    it('should log errors with context', async () => {
      const error = new Error('Test error');
      const context = 'During appointment fetch';

      await service.logError(error, context);

      const stats = service.getStatistics();
      expect(stats!.errorsEncountered).toBe(1);
      const fs = require('fs-extra');
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('error_occurred')
      );
    });

    it('should log string errors', async () => {
      await service.logError('Simple error message');

      const stats = service.getStatistics();
      expect(stats!.errorsEncountered).toBe(1);
    });

    it('should log notifications', async () => {
      const notificationRecord: NotificationRecord = {
        timestamp: new Date(),
        appointmentCount: 3,
        appointments: [],
        channels: ['desktop', 'audio'],
        deliveryStatus: 'success'
      };

      await service.logNotification(notificationRecord);

      const stats = service.getStatistics();
      expect(stats!.notificationsSent).toBe(1);
    });

    it('should throw error when logging notification without active session', async () => {
      await service.endSession();

      const notificationRecord: NotificationRecord = {
        timestamp: new Date(),
        appointmentCount: 3,
        appointments: [],
        channels: ['desktop'],
        deliveryStatus: 'success'
      };

      await expect(service.logNotification(notificationRecord)).rejects.toThrow('No active monitoring session');
    });
  });

  describe('Statistics Calculation', () => {
    beforeEach(async () => {
      await service.startSession('stats-test', {});
    });

    it('should calculate uptime correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      const stats = service.getStatistics();
      expect(stats!.uptime).toBeGreaterThan(0);
      expect(stats!.startTime).toBeInstanceOf(Date);
    });

    it('should calculate average check interval', async () => {
      await service.logCheck(5);
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.logCheck(3);

      const stats = service.getStatistics();
      expect(stats!.averageCheckInterval).toBeGreaterThan(0);
    });

    it('should return null statistics when no session is active', () => {
      const serviceWithoutSession = new StatusLoggerService();
      expect(serviceWithoutSession.getStatistics()).toBeNull();
    });
  });

  describe('Log Export Functionality', () => {
    beforeEach(async () => {
      await service.startSession('export-test', {});
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['monitor.log']);
      fs.readFile.mockResolvedValue('2023-01-01T10:00:00.000Z [INFO] test_event - {"data":"test"}\n');
    });

    it('should export logs in JSON format', async () => {
      const exportPath = await service.exportLogs('json');

      expect(exportPath).toContain('.json');
      const fs = require('fs-extra');
      expect(fs.writeJson).toHaveBeenCalled();
    });

    it('should export logs in CSV format', async () => {
      const exportPath = await service.exportLogs('csv');

      expect(exportPath).toContain('.csv');
      const fs = require('fs-extra');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.csv'),
        expect.stringContaining('Timestamp,Level,Event,Details,SessionId')
      );
    });

    it('should export logs in text format', async () => {
      const exportPath = await service.exportLogs('txt');

      expect(exportPath).toContain('.txt');
      const fs = require('fs-extra');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw error for unsupported export format', async () => {
      await expect(service.exportLogs('xml' as any)).rejects.toThrow('Unsupported export format: xml');
    });

    it('should use custom output path when provided', async () => {
      const customPath = '/custom/path/export.json';
      const exportPath = await service.exportLogs('json', customPath);

      expect(exportPath).toBe(customPath);
    });
  });

  describe('Log File Management', () => {
    beforeEach(() => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['monitor-old.log', 'monitor-older.log', 'monitor.log', 'other.txt']);
      fs.statSync.mockReturnValue({
        mtime: new Date(),
        size: 500
      });
      fs.stat.mockResolvedValue({ size: 2048 });
      fs.pathExists.mockResolvedValue(true);
      fs.remove.mockResolvedValue(undefined);
      fs.move.mockResolvedValue(undefined);
    });

    it('should clean up excess log files', async () => {
      // Setup more log files than the max (3)
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['monitor-1.log', 'monitor-2.log', 'monitor-3.log', 'monitor-4.log', 'monitor.log']);

      await service.cleanupLogs();

      expect(fs.remove).toHaveBeenCalled();
    });

    it('should rotate log file when it exceeds max size', async () => {
      await service.cleanupLogs();

      const fs = require('fs-extra');
      expect(fs.move).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('monitor-')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(service.cleanupLogs()).resolves.not.toThrow();
    });
  });

  describe('Historical Statistics', () => {
    it('should return empty array when no historical data exists', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(false);

      const stats = await service.getHistoricalStatistics();
      expect(stats).toEqual([]);
    });

    it('should return historical statistics when data exists', async () => {
      const mockStats: MonitoringStatistics[] = [{
        sessionId: 'old-session',
        startTime: new Date(),
        uptime: 60000,
        checksPerformed: 10,
        notificationsSent: 2,
        errorsEncountered: 0
      }];

      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockStats);

      const stats = await service.getHistoricalStatistics();
      expect(stats).toEqual(mockStats);
    });

    it('should handle errors when reading historical statistics', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockRejectedValue(new Error('File corrupted'));

      const stats = await service.getHistoricalStatistics();
      expect(stats).toEqual([]);
    });
  });

  describe('Log Parsing', () => {
    it('should parse log lines correctly', async () => {
      const logContent = '2023-01-01T10:00:00.000Z [INFO] test_event - {"key":"value"} (Session: test-session)\n';
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['test.log']);
      fs.readFile.mockResolvedValue(logContent);

      await service.startSession('test', {});
      const exportPath = await service.exportLogs('json');

      expect(fs.writeJson).toHaveBeenCalledWith(
        exportPath,
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            event: 'test_event',
            details: { key: 'value' },
            sessionId: 'test-session'
          })
        ]),
        { spaces: 2 }
      );
    });

    it('should handle malformed log lines gracefully', async () => {
      const logContent = 'invalid log line\n2023-01-01T10:00:00.000Z [INFO] valid_event\n';
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['test.log']);
      fs.readFile.mockResolvedValue(logContent);

      await service.startSession('test', {});
      await expect(service.exportLogs('json')).resolves.not.toThrow();
    });
  });

  describe('Enhanced Appointment Logging', () => {
    let mockAppointments: Appointment[];
    let mockCheckResult: CheckResult;

    beforeEach(async () => {
      await service.startSession('enhanced-logging-test', {});

      mockAppointments = [
        {
          id: 'apt-1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'available',
          price: 150,
          registrationUrl: 'https://example.com/register/1'
        },
        {
          id: 'apt-2',
          date: '2025-02-16',
          time: '13:00-16:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'filled'
        }
      ];

      mockCheckResult = {
        type: 'available',
        appointmentCount: 2,
        availableCount: 1,
        filledCount: 1,
        timestamp: new Date(),
        url: 'https://irsafam.org/ielts/timetable',
        appointments: mockAppointments
      };
    });

    it('should log detailed appointment check results', async () => {
      const checkDuration = 1500;
      await service.logAppointmentCheck(mockCheckResult, checkDuration);

      const stats = service.getStatistics();
      expect(stats!.checksPerformed).toBe(1);

      const fs = require('fs-extra');
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('appointment_check_detailed')
      );
    });

    it('should log individual appointment details when detailed logging is enabled', async () => {
      await service.logAppointmentCheck(mockCheckResult);

      const fs = require('fs-extra');
      // Should log the main check plus individual appointments
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('appointment_detected')
      );
    });

    it('should not log individual appointment details when detailed logging is disabled', async () => {
      const serviceWithoutDetails = new StatusLoggerService({
        logDirectory: '/test-logs',
        enableDetailedAppointmentLogging: false
      });
      await serviceWithoutDetails.startSession('no-details-test', {});

      await serviceWithoutDetails.logAppointmentCheck(mockCheckResult);

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const detailedCalls = calls.filter((call: any) =>
        call[1].includes('appointment_detected')
      );
      expect(detailedCalls).toHaveLength(0);
    });

    it('should use appropriate log levels for different check types', async () => {
      const availableResult: CheckResult = { ...mockCheckResult, type: 'available' };
      const filledResult: CheckResult = { ...mockCheckResult, type: 'filled', availableCount: 0, filledCount: 2 };
      const noSlotsResult: CheckResult = { ...mockCheckResult, type: 'no-slots', appointmentCount: 0, availableCount: 0, filledCount: 0, appointments: [] };

      await service.logAppointmentCheck(availableResult);
      await service.logAppointmentCheck(filledResult);
      await service.logAppointmentCheck(noSlotsResult);

      const fs = require('fs-extra');
      // session start + 1 available check (info level) + 1 available appointment (info level) + 1 filled appointment (info level) = 4 calls
      // filled and no-slots checks are at debug level and filtered out at info level
      expect(fs.appendFile).toHaveBeenCalledTimes(4);
    });

    it('should log appointment summary with counts', async () => {
      await service.logAppointmentSummary(3, 2, 5, 'test_context');

      const fs = require('fs-extra');
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('appointment_summary')
      );
    });

    it('should calculate availability ratio correctly in summary', async () => {
      await service.logAppointmentSummary(2, 3, 5);

      const fs = require('fs-extra');
      const lastCall = fs.appendFile.mock.calls[fs.appendFile.mock.calls.length - 1];
      const logContent = lastCall[1];
      expect(logContent).toContain('"availabilityRatio":0.4');
    });

    it('should handle zero total appointments in summary', async () => {
      // Use a service with debug level to ensure the log is written
      const debugService = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'debug'
      });
      await debugService.startSession('debug-summary-test', {});

      await debugService.logAppointmentSummary(0, 0, 0);

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const summaryCalls = calls.filter((call: any) => call[1].includes('appointment_summary'));
      expect(summaryCalls).toHaveLength(1);
      expect(summaryCalls[0][1]).toContain('"availabilityRatio":0');
    });

    it('should log notification-worthy events for available appointments', async () => {
      await service.logNotificationWorthyEvent(mockAppointments, 'new_appointments_detected');

      const fs = require('fs-extra');
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('monitor.log'),
        expect.stringContaining('notification_worthy_event')
      );
    });

    it('should suppress notifications when no available appointments exist', async () => {
      // Use a service with debug level to ensure the suppression log is written
      const debugService = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'debug'
      });
      await debugService.startSession('debug-suppress-test', {});

      const filledAppointments = mockAppointments.map(apt => ({ ...apt, status: 'filled' as const }));

      await debugService.logNotificationWorthyEvent(filledAppointments, 'check_completed');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const suppressedCalls = calls.filter((call: any) => call[1].includes('notification_suppressed'));
      expect(suppressedCalls).toHaveLength(1);
    });

    it('should log appointment details with correct information', async () => {
      await service.logAppointmentDetails(mockAppointments, 'available');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const appointmentCalls = calls.filter((call: any) =>
        call[1].includes('appointment_detected')
      );

      // Only available appointments are logged at info level, filled ones are at debug level (filtered out)
      expect(appointmentCalls).toHaveLength(1);
      expect(appointmentCalls[0][1]).toContain('apt-1');
    });

    it('should use different log levels for available vs filled appointments', async () => {
      const serviceWithDebugLevel = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'debug',
        enableDetailedAppointmentLogging: true
      });
      await serviceWithDebugLevel.startSession('debug-test', {});

      await serviceWithDebugLevel.logAppointmentDetails(mockAppointments, 'available');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const appointmentCalls = calls.filter((call: any) =>
        call[1].includes('appointment_detected')
      );

      // Both should be logged at debug level, but available ones at info level
      expect(appointmentCalls).toHaveLength(2);
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level configuration for info level', async () => {
      const infoService = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'info'
      });
      await infoService.startSession('info-test', {});

      await infoService.logDebug('debug message');
      await infoService.logInfo('info message');
      await infoService.logWarn('warn message');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const debugCalls = calls.filter((call: any) => call[1].includes('debug message'));
      const infoCalls = calls.filter((call: any) => call[1].includes('info message'));
      const warnCalls = calls.filter((call: any) => call[1].includes('warn message'));

      expect(debugCalls).toHaveLength(0); // Debug should be filtered out
      expect(infoCalls).toHaveLength(1);
      expect(warnCalls).toHaveLength(1);
    });

    it('should respect log level configuration for warn level', async () => {
      const warnService = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'warn'
      });
      await warnService.startSession('warn-test', {});

      await warnService.logDebug('debug message');
      await warnService.logInfo('info message');
      await warnService.logWarn('warn message');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const debugCalls = calls.filter((call: any) => call[1].includes('debug message'));
      const infoCalls = calls.filter((call: any) => call[1].includes('info message'));
      const warnCalls = calls.filter((call: any) => call[1].includes('warn message'));

      expect(debugCalls).toHaveLength(0);
      expect(infoCalls).toHaveLength(0); // Info should be filtered out
      expect(warnCalls).toHaveLength(1);
    });

    it('should log all levels when set to debug', async () => {
      const debugService = new StatusLoggerService({
        logDirectory: '/test-logs',
        logLevel: 'debug'
      });
      await debugService.startSession('debug-test', {});

      await debugService.logDebug('debug message');
      await debugService.logInfo('info message');
      await debugService.logWarn('warn message');

      const fs = require('fs-extra');
      const calls = fs.appendFile.mock.calls;
      const debugCalls = calls.filter((call: any) => call[1].includes('debug message'));
      const infoCalls = calls.filter((call: any) => call[1].includes('info message'));
      const warnCalls = calls.filter((call: any) => call[1].includes('warn message'));

      expect(debugCalls).toHaveLength(1);
      expect(infoCalls).toHaveLength(1);
      expect(warnCalls).toHaveLength(1);
    });
  });

  describe('Enhanced Log Parsing', () => {
    it('should parse debug level log entries correctly', async () => {
      const logContent = '2023-01-01T10:00:00.000Z [DEBUG] debug_event - {"key":"value"} (Session: test-session)\n';
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue(['test.log']);
      fs.readFile.mockResolvedValue(logContent);

      await service.startSession('test', {});
      const exportPath = await service.exportLogs('json');

      expect(fs.writeJson).toHaveBeenCalledWith(
        exportPath,
        expect.arrayContaining([
          expect.objectContaining({
            level: 'debug',
            event: 'debug_event',
            details: { key: 'value' },
            sessionId: 'test-session'
          })
        ]),
        { spaces: 2 }
      );
    });
  });
});