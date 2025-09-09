import { ErrorHandlerService, ErrorType, ErrorSeverity } from '../ErrorHandlerService';
import { StatusLoggerService } from '../StatusLoggerService';
import { NotificationService } from '../NotificationService';
import * as fs from 'fs-extra';

// Mock dependencies
jest.mock('../StatusLoggerService');
jest.mock('../NotificationService');
jest.mock('fs-extra');

describe('ErrorHandlerService', () => {
  let errorHandler: ErrorHandlerService;
  let mockStatusLogger: jest.Mocked<StatusLoggerService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockStatusLogger = new StatusLoggerService() as jest.Mocked<StatusLoggerService>;
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;
    
    // Mock methods
    mockStatusLogger.logError = jest.fn();
    mockStatusLogger.logWarn = jest.fn();
    mockStatusLogger.logInfo = jest.fn();
    mockNotificationService.sendNotification = jest.fn();
    
    jest.mocked(fs.ensureDir).mockResolvedValue(undefined);
    jest.mocked(fs.appendFile).mockResolvedValue(undefined);
    jest.mocked(fs.writeJson).mockResolvedValue(undefined);

    errorHandler = new ErrorHandlerService(mockStatusLogger, mockNotificationService, {
      persistentErrorThreshold: 3,
      errorLogPath: '/test/errors.log'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    errorHandler.clearErrorHistory();
  });

  describe('Error Categorization', () => {
    test('should categorize network errors correctly', () => {
      const networkError = new Error('ENOTFOUND example.com');
      const enhanced = errorHandler.enhanceError(networkError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.type).toBe(ErrorType.NETWORK);
      expect(enhanced.severity).toBe(ErrorSeverity.MEDIUM);
    });

    test('should categorize parsing errors correctly', () => {
      const parseError = new Error('Failed to parse HTML selector');
      const enhanced = errorHandler.enhanceError(parseError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.type).toBe(ErrorType.PARSING);
      expect(enhanced.severity).toBe(ErrorSeverity.LOW);
    });

    test('should categorize timeout errors correctly', () => {
      const timeoutError = new Error('Navigation timeout exceeded');
      const enhanced = errorHandler.enhanceError(timeoutError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.type).toBe(ErrorType.TIMEOUT);
      expect(enhanced.severity).toBe(ErrorSeverity.MEDIUM);
    });

    test('should categorize file system errors correctly', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      const enhanced = errorHandler.enhanceError(fsError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.type).toBe(ErrorType.FILE_SYSTEM);
      expect(enhanced.severity).toBe(ErrorSeverity.MEDIUM);
    });

    test('should categorize critical errors correctly', () => {
      const criticalError = new ReferenceError('undefined variable');
      const enhanced = errorHandler.enhanceError(criticalError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.type).toBe(ErrorType.CRITICAL);
      expect(enhanced.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('Recovery Strategies', () => {
    test('should allow retry for network errors', () => {
      const networkError = new Error('ECONNREFUSED');
      const enhanced = errorHandler.enhanceError(networkError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.canRecover).toBe(true);
      expect(enhanced.recoveryStrategy.type).toBe('retry');
      expect(enhanced.recoveryStrategy.maxAttempts).toBe(3);
    });

    test('should not allow recovery for critical errors', () => {
      const criticalError = new Error('Critical system failure');
      const enhanced = errorHandler.enhanceError(criticalError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });

      expect(enhanced.canRecover).toBe(false);
      expect(enhanced.recoveryStrategy.type).toBe('stop');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle recoverable errors', async () => {
      const networkError = new Error('Network timeout');
      const enhanced = errorHandler.enhanceError(networkError, {
        operation: 'fetch',
        component: 'WebScraper',
        timestamp: new Date()
      });

      const recovered = await errorHandler.handleError(enhanced);
      
      expect(recovered).toBe(true);
      expect(mockStatusLogger.logError).toHaveBeenCalled();
    });

    test('should handle non-recoverable errors', async () => {
      const criticalError = new Error('Critical configuration error');
      const enhanced = errorHandler.enhanceError(criticalError, {
        operation: 'init',
        component: 'Config',
        timestamp: new Date()
      });

      const recovered = await errorHandler.handleError(enhanced);
      
      expect(recovered).toBe(false);
      expect(mockStatusLogger.logError).toHaveBeenCalled();
    });

    test('should track persistent errors', async () => {
      const persistentError = new Error('Persistent network issue');
      
      // Simulate multiple occurrences of the same error
      for (let i = 0; i < 4; i++) {
        const enhanced = errorHandler.enhanceError(persistentError, {
          operation: 'fetch',
          component: 'WebScraper',
          timestamp: new Date()
        });
        await errorHandler.handleError(enhanced);
      }

      const stats = errorHandler.getErrorStatistics();
      expect(stats.persistentErrors).toBe(1);
    });
  });

  describe('Error Statistics', () => {
    test('should provide accurate error statistics', async () => {
      // Add various types of errors
      const errors = [
        new Error('Network error'),
        new Error('Parse error'),
        new Error('Timeout error')
      ];

      for (const error of errors) {
        const enhanced = errorHandler.enhanceError(error, {
          operation: 'test',
          component: 'test',
          timestamp: new Date()
        });
        await errorHandler.handleError(enhanced);
      }

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType[ErrorType.NETWORK]).toBe(1);
      expect(stats.errorsByType[ErrorType.PARSING]).toBe(1);
      expect(stats.errorsByType[ErrorType.TIMEOUT]).toBe(1);
    });
  });

  describe('Error Export', () => {
    test('should export error logs successfully', async () => {
      const testError = new Error('Test error for export');
      const enhanced = errorHandler.enhanceError(testError, {
        operation: 'test',
        component: 'test',
        timestamp: new Date()
      });
      
      await errorHandler.handleError(enhanced);
      
      const exportPath = await errorHandler.exportErrorLogs('/test/export.json');
      
      expect(fs.writeJson).toHaveBeenCalled();
      expect(exportPath).toContain('export');
    });
  });
});