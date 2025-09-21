import { StatusDisplay } from '../StatusDisplay';
import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { MonitoringStatistics } from '../../services/StatusLoggerService';

// Mock dependencies
jest.mock('../../services/MonitorController');

describe('StatusDisplay', () => {
  let statusDisplay: StatusDisplay;
  let mockMonitorController: jest.Mocked<MonitorController>;

  beforeEach(() => {
    jest.clearAllMocks();
    statusDisplay = new StatusDisplay();
    mockMonitorController = new MonitorController() as jest.Mocked<MonitorController>;
  });

  describe('displayStatus', () => {
    it('should display complete status information', async () => {
      const mockStatus = {
        status: MonitorStatus.RUNNING,
        session: {
          sessionId: 'test-session-123',
          startTime: new Date('2025-01-15T10:00:00Z'),
          checksPerformed: 25,
          notificationsSent: 3,
          errors: []
        },
        config: {
          city: ['isfahan', 'tehran'],
          examModel: ['cdielts'],
          months: [12, 1, 2],
          checkInterval: 30000,
          notificationSettings: {
            desktop: true,
            audio: true,
            logFile: true
          }
        },
        statistics: {
          sessionId: 'test-session-123',
          startTime: new Date('2025-01-15T10:00:00Z'),
          checksPerformed: 25,
          notificationsSent: 3,
          errorsEncountered: 0,
          uptime: 3600000, // 1 hour
          averageCheckInterval: 30000,
          lastCheckTime: new Date('2025-01-15T11:00:00Z'),
          lastNotificationTime: new Date('2025-01-15T10:30:00Z')
        }
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await statusDisplay.displayStatus(mockStatus);

      // Verify output contains expected information
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('IELTS Monitor Status'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RUNNING'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-session-123'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('isfahan, tehran'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('25'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('3'));

      consoleSpy.mockRestore();
    });

    it('should display status without optional fields', async () => {
      const mockStatus = {
        status: MonitorStatus.STOPPED
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await statusDisplay.displayStatus(mockStatus);

      // Verify basic status is displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('STOPPED'));

      consoleSpy.mockRestore();
    });

    it('should display recent errors when present', async () => {
      const mockStatus = {
        status: MonitorStatus.ERROR,
        session: {
          sessionId: 'test-session',
          startTime: new Date(),
          checksPerformed: 5,
          notificationsSent: 0,
          errors: [
            {
              timestamp: new Date('2025-01-15T10:00:00Z'),
              error: 'Network timeout',
              context: 'Web scraping'
            },
            {
              timestamp: new Date('2025-01-15T10:05:00Z'),
              error: 'Parse error',
              context: 'HTML parsing'
            }
          ]
        }
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await statusDisplay.displayStatus(mockStatus);

      // Verify errors are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Errors'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network timeout'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Parse error'));

      consoleSpy.mockRestore();
    });
  });

  describe('displayStatistics', () => {
    it('should display all available statistics', () => {
      const mockStats: MonitoringStatistics = {
        sessionId: 'test-session',
        startTime: new Date('2025-01-15T10:00:00Z'),
        uptime: 7200000, // 2 hours
        checksPerformed: 100,
        notificationsSent: 5,
        errorsEncountered: 2,
        averageCheckInterval: 30000,
        lastCheckTime: new Date('2025-01-15T12:00:00Z'),
        lastNotificationTime: new Date('2025-01-15T11:30:00Z')
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      statusDisplay.displayStatistics(mockStats);

      // Verify statistics are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('100'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('5'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2h'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('30.0s'));

      consoleSpy.mockRestore();
    });

    it('should handle missing optional statistics', () => {
      const mockStats: MonitoringStatistics = {
        sessionId: 'test-session',
        startTime: new Date(),
        uptime: 60000,
        checksPerformed: 10,
        notificationsSent: 1,
        errorsEncountered: 0
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      statusDisplay.displayStatistics(mockStats);

      // Verify basic statistics are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('10'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0'));

      consoleSpy.mockRestore();
    });
  });

  describe('startRealTimeDisplay', () => {
    it('should setup event listeners and display initial status', async () => {
      // Mock monitor controller methods
      mockMonitorController.getStatus.mockResolvedValue({
        status: MonitorStatus.RUNNING,
        session: {
          sessionId: 'test-session',
          startTime: new Date(),
          checksPerformed: 0,
          notificationsSent: 0,
          errors: [],
          configuration: {
            city: ['isfahan'],
            examModel: ['cdielts'],
            months: [12, 1, 2],
            checkInterval: 30000,
            notificationSettings: {
              desktop: true,
              audio: true,
              logFile: true
            }
          }
        }
      });

      mockMonitorController.on = jest.fn();

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute (with timeout to prevent hanging)
      const promise = statusDisplay.startRealTimeDisplay(mockMonitorController);
      
      // Wait a bit then resolve
      setTimeout(() => {
        // Simulate Ctrl+C
        process.emit('SIGINT', 'SIGINT');
      }, 100);

      try {
        await Promise.race([
          promise,
          new Promise(resolve => setTimeout(resolve, 200))
        ]);
      } catch (error) {
        // Expected for SIGINT
      }

      // Verify event listeners were setup
      expect(mockMonitorController.on).toHaveBeenCalledWith('check-completed', expect.any(Function));
      expect(mockMonitorController.on).toHaveBeenCalledWith('new-appointments', expect.any(Function));
      expect(mockMonitorController.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockMonitorController.on).toHaveBeenCalledWith('status-changed', expect.any(Function));

      consoleSpy.mockRestore();
    });
  });

  describe('startWatchMode', () => {
    it('should start watch mode with periodic updates', async () => {
      // Mock monitor controller
      mockMonitorController.getStatus.mockResolvedValue({
        status: MonitorStatus.RUNNING
      });

      // Mock process.stdout.write for screen clearing
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute with timeout
      const promise = statusDisplay.startWatchMode(mockMonitorController);
      
      // Wait a bit then simulate Ctrl+C
      setTimeout(() => {
        process.emit('SIGINT', 'SIGINT');
      }, 100);

      try {
        await Promise.race([
          promise,
          new Promise(resolve => setTimeout(resolve, 200))
        ]);
      } catch (error) {
        // Expected for SIGINT
      }

      // Verify screen clearing and status display
      expect(stdoutSpy).toHaveBeenCalledWith('\x1B[2J\x1B[0f');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Watch Mode'));

      stdoutSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('duration formatting', () => {
    it('should format durations correctly', () => {
      // Test private method through public interface
      const mockStatus = {
        status: MonitorStatus.RUNNING,
        session: {
          sessionId: 'test',
          startTime: new Date(Date.now() - 3661000), // 1 hour, 1 minute, 1 second ago
          checksPerformed: 1,
          notificationsSent: 0,
          errors: []
        }
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      statusDisplay.displayStatus(mockStatus);

      // Verify duration formatting (should contain hours, minutes, seconds)
      const durationCall = consoleSpy.mock.calls.find(call => 
        call[0].includes('Duration:')
      );
      expect(durationCall).toBeDefined();
      expect(durationCall![0]).toMatch(/1h.*1m.*1s/);

      consoleSpy.mockRestore();
    });
  });

  describe('month name conversion', () => {
    it('should convert month numbers to names correctly', async () => {
      const mockStatus = {
        status: MonitorStatus.RUNNING,
        config: {
          city: ['isfahan'],
          examModel: ['cdielts'],
          months: [1, 6, 12], // January, June, December
          checkInterval: 30000,
          notificationSettings: {
            desktop: true,
            audio: true,
            logFile: true
          }
        }
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusDisplay.displayStatus(mockStatus);

      // Verify month names are displayed
      const monthCall = consoleSpy.mock.calls.find(call => 
        call[0].includes('Months:')
      );
      expect(monthCall).toBeDefined();
      expect(monthCall![0]).toContain('January');
      expect(monthCall![0]).toContain('June');
      expect(monthCall![0]).toContain('December');

      consoleSpy.mockRestore();
    });
  });
});