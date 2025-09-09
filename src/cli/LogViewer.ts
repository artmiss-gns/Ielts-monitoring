import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Log viewer component for CLI
 */
export class LogViewer {
  private readonly logDir: string = 'logs';
  private followInterval: NodeJS.Timeout | null = null;

  /**
   * Show recent log entries
   */
  async showLogs(lines: number = 50): Promise<void> {
    try {
      const logFiles = await this.getLogFiles();
      
      if (logFiles.length === 0) {
        console.log(chalk.yellow('📋 No log files found'));
        return;
      }

      // Get the most recent log file
      const latestLogFile = logFiles[0];
      console.log(chalk.blue(`📋 Showing last ${lines} entries from: ${latestLogFile.name}\n`));

      const logContent = await fs.readFile(latestLogFile.path, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      
      // Get the last N lines
      const recentLines = logLines.slice(-lines);
      
      if (recentLines.length === 0) {
        console.log(chalk.gray('No log entries found'));
        return;
      }

      // Display log entries with formatting
      recentLines.forEach(line => {
        this.displayLogLine(line);
      });

      console.log(chalk.gray(`\nShowing ${recentLines.length} of ${logLines.length} total entries`));

    } catch (error) {
      throw new Error(`Failed to read logs: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Follow logs in real-time (tail -f behavior)
   */
  async followLogs(initialLines: number = 50): Promise<void> {
    try {
      // Show initial log entries
      await this.showLogs(initialLines);
      console.log(chalk.gray('\n' + '─'.repeat(50)));
      console.log(chalk.blue('Following new log entries...'));
      console.log(chalk.gray('─'.repeat(50) + '\n'));

      const logFiles = await this.getLogFiles();
      if (logFiles.length === 0) {
        console.log(chalk.yellow('No log files to follow'));
        return;
      }

      const latestLogFile = logFiles[0];
      let lastSize = (await fs.stat(latestLogFile.path)).size;
      let lastPosition = lastSize;

      // Setup file watching
      this.followInterval = setInterval(async () => {
        try {
          const currentStats = await fs.stat(latestLogFile.path);
          
          if (currentStats.size > lastSize) {
            // File has grown, read new content
            const stream = fs.createReadStream(latestLogFile.path, {
              start: lastPosition,
              encoding: 'utf-8'
            });

            let buffer = '';
            stream.on('data', (chunk: string | Buffer) => {
              buffer += chunk.toString();
            });

            stream.on('end', () => {
              const newLines = buffer.split('\n').filter(line => line.trim());
              newLines.forEach(line => {
                this.displayLogLine(line);
              });
              
              lastSize = currentStats.size;
              lastPosition = currentStats.size;
            });
          }
        } catch (error) {
          // File might have been rotated or deleted, try to find new log file
          const updatedLogFiles = await this.getLogFiles();
          if (updatedLogFiles.length > 0 && updatedLogFiles[0].path !== latestLogFile.path) {
            console.log(chalk.blue('\n📋 Log file rotated, following new file...\n'));
            // Reset tracking for new file
            lastSize = 0;
            lastPosition = 0;
          }
        }
      }, 1000); // Check every second

      // Handle cleanup on exit
      process.on('SIGINT', () => {
        if (this.followInterval) {
          clearInterval(this.followInterval);
          this.followInterval = null;
        }
        console.log(chalk.gray('\nStopped following logs'));
        process.exit(0);
      });

    } catch (error) {
      throw new Error(`Failed to follow logs: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get available log files sorted by modification time (newest first)
   */
  private async getLogFiles(): Promise<Array<{ name: string; path: string; mtime: Date }>> {
    try {
      if (!(await fs.pathExists(this.logDir))) {
        return [];
      }

      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime
          };
        })
      );

      // Sort by modification time (newest first)
      return fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    } catch (error) {
      throw new Error(`Failed to get log files: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Display a single log line with appropriate formatting
   */
  private displayLogLine(line: string): void {
    if (!line.trim()) return;

    try {
      // Try to parse as JSON log entry
      const logEntry = JSON.parse(line);
      
      const timestamp = new Date(logEntry.timestamp).toLocaleString();
      const level = logEntry.level?.toUpperCase() || 'INFO';
      const message = logEntry.message || '';
      
      // Color code by log level
      let levelColor: (text: string) => string;
      let prefix: string;
      
      switch (level) {
        case 'ERROR':
          levelColor = chalk.red;
          prefix = '❌';
          break;
        case 'WARN':
        case 'WARNING':
          levelColor = chalk.yellow;
          prefix = '⚠️ ';
          break;
        case 'INFO':
          levelColor = chalk.blue;
          prefix = 'ℹ️ ';
          break;
        case 'DEBUG':
          levelColor = chalk.gray;
          prefix = '🔍';
          break;
        default:
          levelColor = chalk.white;
          prefix = '📝';
      }

      console.log(
        `${chalk.gray(timestamp)} ${levelColor(prefix + level.padEnd(5))} ${message}`
      );

      // Display additional context if available
      if (logEntry.context && typeof logEntry.context === 'object') {
        const contextStr = JSON.stringify(logEntry.context, null, 2);
        console.log(chalk.gray('  Context: ' + contextStr));
      }

      // Display error stack if available
      if (logEntry.stack) {
        console.log(chalk.red('  Stack: ' + logEntry.stack));
      }

    } catch {
      // Not JSON, display as plain text
      console.log(chalk.gray(line));
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestLog?: Date;
    newestLog?: Date;
  }> {
    try {
      const logFiles = await this.getLogFiles();
      
      if (logFiles.length === 0) {
        return { totalFiles: 0, totalSize: 0 };
      }

      let totalSize = 0;
      for (const file of logFiles) {
        const stats = await fs.stat(file.path);
        totalSize += stats.size;
      }

      return {
        totalFiles: logFiles.length,
        totalSize,
        oldestLog: logFiles[logFiles.length - 1]?.mtime,
        newestLog: logFiles[0]?.mtime
      };

    } catch (error) {
      throw new Error(`Failed to get log statistics: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupLogs(keepDays: number = 7): Promise<number> {
    try {
      const logFiles = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      let deletedCount = 0;
      
      for (const file of logFiles) {
        if (file.mtime < cutoffDate) {
          await fs.remove(file.path);
          deletedCount++;
        }
      }

      return deletedCount;

    } catch (error) {
      throw new Error(`Failed to cleanup logs: ${error instanceof Error ? error.message : error}`);
    }
  }
}