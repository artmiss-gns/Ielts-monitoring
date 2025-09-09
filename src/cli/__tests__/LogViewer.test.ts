import { LogViewer } from '../LogViewer';
import * as fs from 'fs-extra';

// Mock fs-extra
jest.mock('fs-extra');

describe('LogViewer', () => {
  let logViewer: LogViewer;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    logViewer = new LogViewer();
  });

  describe('showLogs', () => {
    it('should display recent log entries', async () => {
      // Setup mock log content

      const mockLogContent = [
        '{"timestamp":"2025-01-15T10:00:00Z","level":"info","message":"Monitor started"}',
        '{"timestamp":"2025-01-15T10:01:00Z","level":"info","message":"Check completed","context":{"appointments":5}}',
        '{"timestamp":"2025-01-15T10:02:00Z","level":"error","message":"Network error","stack":"Error: timeout"}',
        '{"timestamp":"2025-01-15T10:03:00Z","level":"warn","message":"Retry attempt"}',
        '{"timestamp":"2025-01-15T10:04:00Z","level":"info","message":"Check completed","context":{"appointments":3}}'
      ].join('\n');

      // Mock file system operations
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['monitor-2025-01-15.log']);
      (mockFs.stat as jest.Mock).mockResolvedValue({ mtime: new Date('2025-01-15T12:00:00Z') });
      (mockFs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await logViewer.showLogs(3);

      // Verify file operations
      expect(mockFs.pathExists).toHaveBeenCalledWith('logs');
      expect(mockFs.readdir).toHaveBeenCalledWith('logs');
      expect(mockFs.readFile).toHaveBeenCalledWith('logs/monitor-2025-01-15.log', 'utf-8');

      // Verify log display
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Showing last 3 entries'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retry attempt'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Check completed'));

      consoleSpy.mockRestore();
    });

    it('should handle no log files gracefully', async () => {
      // Mock no log directory
      (mockFs.pathExists as jest.Mock).mockResolvedValue(false);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await logViewer.showLogs(10);

      // Verify message
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No log files found'));

      consoleSpy.mockRestore();
    });

    it('should handle empty log files', async () => {
      // Setup mock empty log file
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['empty.log']);
      (mockFs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
      (mockFs.readFile as jest.Mock).mockResolvedValue('');

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await logViewer.showLogs(10);

      // Verify message
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No log entries found'));

      consoleSpy.mockRestore();
    });

    it('should handle non-JSON log lines', async () => {
      // Setup mock log with mixed content
      const mockLogContent = [
        '{"timestamp":"2025-01-15T10:00:00Z","level":"info","message":"JSON log"}',
        'Plain text log line',
        'Another plain text line'
      ].join('\n');

      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['mixed.log']);
      (mockFs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
      (mockFs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await logViewer.showLogs(10);

      // Verify both JSON and plain text are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JSON log'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Plain text log line'));

      consoleSpy.mockRestore();
    });
  });

  describe('followLogs', () => {
    it('should setup file watching for new log entries', async () => {
      // Setup initial log content
      const initialContent = '{"timestamp":"2025-01-15T10:00:00Z","level":"info","message":"Initial log"}';
      
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['current.log']);
      (mockFs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtime: new Date() }) // For initial file list
        .mockResolvedValue({ size: initialContent.length }); // For file watching
      (mockFs.readFile as jest.Mock).mockResolvedValue(initialContent);
      (mockFs.createReadStream as jest.Mock) = jest.fn().mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('{"timestamp":"2025-01-15T10:01:00Z","level":"info","message":"New log entry"}');
          } else if (event === 'end') {
            callback();
          }
        })
      });

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute with timeout to prevent hanging
      const promise = logViewer.followLogs(1);
      
      // Simulate Ctrl+C after a short delay
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

      // Verify initial display
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Following new log entries'));

      consoleSpy.mockRestore();
    });

    it('should handle log file rotation', async () => {
      // Setup mock for file rotation scenario
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock)
        .mockResolvedValueOnce(['old.log']) // Initial file list
        .mockResolvedValueOnce(['new.log']); // After rotation
      (mockFs.stat as jest.Mock).mockResolvedValue({ 
        mtime: new Date(),
        size: 100 
      });
      (mockFs.readFile as jest.Mock).mockResolvedValue('{"timestamp":"2025-01-15T10:00:00Z","level":"info","message":"Log"}');

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute with timeout
      const promise = logViewer.followLogs(1);
      
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

      consoleSpy.mockRestore();
    });
  });

  describe('getLogStatistics', () => {
    it('should return log statistics', async () => {
      // Setup mock log files
      const mockFiles = [
        { name: 'log1.log', path: 'logs/log1.log', mtime: new Date('2025-01-15T10:00:00Z') },
        { name: 'log2.log', path: 'logs/log2.log', mtime: new Date('2025-01-15T11:00:00Z') }
      ];

      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['log1.log', 'log2.log']);
      (mockFs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtime: mockFiles[0].mtime })
        .mockResolvedValueOnce({ mtime: mockFiles[1].mtime })
        .mockResolvedValueOnce({ size: 1000 }) // File 1 size
        .mockResolvedValueOnce({ size: 2000 }); // File 2 size

      // Execute
      const stats = await logViewer.getLogStatistics();

      // Verify statistics
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.oldestLog).toEqual(mockFiles[0].mtime);
      expect(stats.newestLog).toEqual(mockFiles[1].mtime);
    });

    it('should handle no log files', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(false);

      // Execute
      const stats = await logViewer.getLogStatistics();

      // Verify empty statistics
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestLog).toBeUndefined();
      expect(stats.newestLog).toBeUndefined();
    });
  });

  describe('cleanupLogs', () => {
    it('should delete old log files', async () => {
      // Setup mock old and new files
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old

      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 3); // 3 days old

      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['old.log', 'new.log']);
      (mockFs.stat as jest.Mock)
        .mockResolvedValueOnce({ mtime: oldDate })
        .mockResolvedValueOnce({ mtime: newDate });
      (mockFs.remove as jest.Mock).mockResolvedValue(undefined);

      // Execute (keep files newer than 7 days)
      const deletedCount = await logViewer.cleanupLogs(7);

      // Verify old file was deleted
      expect(deletedCount).toBe(1);
      expect(mockFs.remove).toHaveBeenCalledWith('logs/old.log');
      expect(mockFs.remove).not.toHaveBeenCalledWith('logs/new.log');
    });

    it('should handle cleanup errors gracefully', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Execute and expect error
      await expect(logViewer.cleanupLogs(7))
        .rejects.toThrow('Failed to cleanup logs: Permission denied');
    });
  });

  describe('log line formatting', () => {
    it('should format different log levels with appropriate colors', async () => {
      const mockLogContent = [
        '{"timestamp":"2025-01-15T10:00:00Z","level":"error","message":"Error message","stack":"Error stack"}',
        '{"timestamp":"2025-01-15T10:01:00Z","level":"warn","message":"Warning message"}',
        '{"timestamp":"2025-01-15T10:02:00Z","level":"info","message":"Info message","context":{"key":"value"}}',
        '{"timestamp":"2025-01-15T10:03:00Z","level":"debug","message":"Debug message"}'
      ].join('\n');

      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockFs.readdir as jest.Mock).mockResolvedValue(['test.log']);
      (mockFs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
      (mockFs.readFile as jest.Mock).mockResolvedValue(mockLogContent);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Execute
      await logViewer.showLogs(10);

      // Verify different log levels are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Info message'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debug message'));

      // Verify context and stack are displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Context:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Stack:'));

      consoleSpy.mockRestore();
    });
  });
});