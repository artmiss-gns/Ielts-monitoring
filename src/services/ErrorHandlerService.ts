import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { StatusLoggerService } from './StatusLoggerService';
import { NotificationService } from './NotificationService';

/**
 * Error types for categorization and handling
 */
export enum ErrorType {
  NETWORK = 'network',
  PARSING = 'parsing',
  FILE_SYSTEM = 'file_system',
  CONFIGURATION = 'configuration',
  NOTIFICATION = 'notification',
  TIMEOUT = 'timeout',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error context information
 */
export interface ErrorContext {
  operation: string;
  component: string;
  timestamp: Date;
  sessionId?: string;
  additionalData?: any;
}

/**
 * Error recovery strategy
 */
export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'skip' | 'stop';
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

/**
 * Enhanced error information
 */
export interface EnhancedError {
  originalError: Error;
  type: ErrorType;
  severity: ErrorSeverity;
  context: ErrorContext;
  recoveryStrategy: RecoveryStrategy;
  attemptCount: number;
  canRecover: boolean;
}/**
 
* Comprehensive Error Handler Service
 * Provides centralized error handling, recovery strategies, and user notifications
 */
export class ErrorHandlerService extends EventEmitter {
  private statusLogger: StatusLoggerService;
  private notificationService: NotificationService;
  private errorHistory: EnhancedError[] = [];
  private recoveryAttempts: Map<string, number> = new Map();
  private persistentErrorThreshold: number = 5;
  private errorLogPath: string;

  constructor(
    statusLogger: StatusLoggerService,
    notificationService: NotificationService,
    options?: {
      persistentErrorThreshold?: number;
      errorLogPath?: string;
    }
  ) {
    super();
    this.statusLogger = statusLogger;
    this.notificationService = notificationService;
    this.persistentErrorThreshold = options?.persistentErrorThreshold || 5;
    this.errorLogPath = options?.errorLogPath || path.join(process.cwd(), 'logs', 'errors.log');
    
    this.setupGlobalErrorHandlers();
    this.ensureErrorLogDirectory();
  }

  /**
   * Setup global error handlers for unhandled exceptions and rejections
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      const enhancedError = this.enhanceError(error, {
        operation: 'uncaught_exception',
        component: 'global',
        timestamp: new Date()
      });
      
      await this.handleError(enhancedError);
      
      // For critical errors, exit gracefully
      if (enhancedError.severity === ErrorSeverity.CRITICAL) {
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(`Unhandled rejection: ${reason}`);
      const enhancedError = this.enhanceError(error, {
        operation: 'unhandled_rejection',
        component: 'global',
        timestamp: new Date(),
        additionalData: { promise }
      });
      
      await this.handleError(enhancedError);
    });
  } 
 /**
   * Main error handling method
   */
  async handleError(enhancedError: EnhancedError): Promise<boolean> {
    try {
      // Add to error history
      this.errorHistory.push(enhancedError);
      
      // Log error with full context
      await this.logErrorWithContext(enhancedError);
      
      // Emit error event for listeners
      this.emit('error', enhancedError);
      
      // Check for persistent errors
      await this.checkPersistentErrors(enhancedError);
      
      // Attempt recovery if possible
      if (enhancedError.canRecover) {
        return await this.attemptRecovery(enhancedError);
      }
      
      return false;
    } catch (handlingError) {
      console.error('Error in error handler:', handlingError);
      return false;
    }
  }

  /**
   * Enhance basic error with type, severity, and recovery strategy
   */
  enhanceError(error: Error, context: ErrorContext): EnhancedError {
    const type = this.categorizeError(error);
    const severity = this.determineSeverity(error, type);
    const recoveryStrategy = this.getRecoveryStrategy(type, severity);
    const attemptCount = this.recoveryAttempts.get(this.getErrorKey(error, context)) || 0;
    
    return {
      originalError: error,
      type,
      severity,
      context,
      recoveryStrategy,
      attemptCount,
      canRecover: this.canRecover(type, severity, attemptCount)
    };
  }

  /**
   * Categorize error by type
   */
  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('network') || message.includes('timeout') || message.includes('enotfound') || 
        message.includes('econnrefused') || message.includes('econnreset')) {
      return ErrorType.NETWORK;
    }
    
    if (message.includes('parse') || message.includes('html') || message.includes('selector') ||
        message.includes('element not found')) {
      return ErrorType.PARSING;
    }
    
    if (message.includes('enoent') || message.includes('eacces') || message.includes('file') ||
        stack.includes('fs.') || stack.includes('readfile') || stack.includes('writefile')) {
      return ErrorType.FILE_SYSTEM;
    }
    
    if (message.includes('configuration') || message.includes('config') || message.includes('invalid')) {
      return ErrorType.CONFIGURATION;
    }
    
    if (message.includes('notification') || message.includes('notifier')) {
      return ErrorType.NOTIFICATION;
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }
    
    if (message.includes('critical') || message.includes('fatal') || error.name === 'ReferenceError') {
      return ErrorType.CRITICAL;
    }
    
    return ErrorType.UNKNOWN;
  }  /**
   *
 Determine error severity
   */
  private determineSeverity(error: Error, type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.CRITICAL:
        return ErrorSeverity.CRITICAL;
      case ErrorType.CONFIGURATION:
        return ErrorSeverity.HIGH;
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      case ErrorType.PARSING:
      case ErrorType.NOTIFICATION:
        return ErrorSeverity.LOW;
      case ErrorType.FILE_SYSTEM:
        return error.message.includes('EACCES') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Get recovery strategy based on error type and severity
   */
  private getRecoveryStrategy(type: ErrorType, severity: ErrorSeverity): RecoveryStrategy {
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
        return {
          type: 'retry',
          maxAttempts: 3,
          delay: 1000,
          backoffMultiplier: 2,
          maxDelay: 60000
        };
      
      case ErrorType.PARSING:
        return {
          type: 'retry',
          maxAttempts: 2,
          delay: 5000
        };
      
      case ErrorType.FILE_SYSTEM:
        return severity === ErrorSeverity.HIGH ? 
          { type: 'stop' } : 
          { type: 'retry', maxAttempts: 2, delay: 1000 };
      
      case ErrorType.NOTIFICATION:
        return {
          type: 'fallback',
          maxAttempts: 3,
          delay: 500
        };
      
      case ErrorType.CONFIGURATION:
      case ErrorType.CRITICAL:
        return { type: 'stop' };
      
      default:
        return {
          type: 'retry',
          maxAttempts: 1,
          delay: 1000
        };
    }
  }

  /**
   * Check if error can be recovered from
   */
  private canRecover(type: ErrorType, severity: ErrorSeverity, attemptCount: number): boolean {
    if (severity === ErrorSeverity.CRITICAL) return false;
    if (type === ErrorType.CONFIGURATION) return false;
    
    const strategy = this.getRecoveryStrategy(type, severity);
    return strategy.type !== 'stop' && attemptCount < (strategy.maxAttempts || 1);
  }  /**
  
 * Attempt error recovery
   */
  private async attemptRecovery(enhancedError: EnhancedError): Promise<boolean> {
    const errorKey = this.getErrorKey(enhancedError.originalError, enhancedError.context);
    const currentAttempts = this.recoveryAttempts.get(errorKey) || 0;
    
    this.recoveryAttempts.set(errorKey, currentAttempts + 1);
    
    const strategy = enhancedError.recoveryStrategy;
    
    switch (strategy.type) {
      case 'retry':
        return await this.handleRetryStrategy(enhancedError, strategy);
      
      case 'fallback':
        return await this.handleFallbackStrategy(enhancedError);
      
      case 'skip':
        await this.statusLogger.logWarn('Skipping operation due to error', {
          error: enhancedError.originalError.message,
          context: enhancedError.context
        });
        return true;
      
      case 'stop':
        await this.statusLogger.logError(enhancedError.originalError, 'Critical error - stopping operation');
        this.emit('critical-error', enhancedError);
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Handle retry strategy with exponential backoff
   */
  private async handleRetryStrategy(enhancedError: EnhancedError, strategy: RecoveryStrategy): Promise<boolean> {
    const delay = Math.min(
      (strategy.delay || 1000) * Math.pow(strategy.backoffMultiplier || 1, enhancedError.attemptCount),
      strategy.maxDelay || 60000
    );
    
    await this.statusLogger.logWarn(`Retrying operation after error (attempt ${enhancedError.attemptCount + 1})`, {
      error: enhancedError.originalError.message,
      delay,
      context: enhancedError.context
    });
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    this.emit('retry-attempt', enhancedError, delay);
    return true;
  }

  /**
   * Handle fallback strategy for notifications
   */
  private async handleFallbackStrategy(enhancedError: EnhancedError): Promise<boolean> {
    if (enhancedError.type === ErrorType.NOTIFICATION) {
      try {
        // Try alternative notification methods
        await this.statusLogger.logWarn('Notification failed, using fallback method', {
          error: enhancedError.originalError.message
        });
        
        // Fallback to console notification
        console.log('🚨 NOTIFICATION FALLBACK: New IELTS appointments detected!');
        return true;
      } catch (fallbackError) {
        await this.statusLogger.logError(fallbackError as Error, 'Fallback notification also failed');
        return false;
      }
    }
    
    return false;
  }  /**

   * Check for persistent errors and notify user
   */
  private async checkPersistentErrors(enhancedError: EnhancedError): Promise<void> {
    const errorKey = this.getErrorKey(enhancedError.originalError, enhancedError.context);
    const attempts = this.recoveryAttempts.get(errorKey) || 0;
    
    if (attempts >= this.persistentErrorThreshold) {
      await this.notifyPersistentError(enhancedError);
    }
  }

  /**
   * Notify user of persistent errors requiring attention
   */
  private async notifyPersistentError(enhancedError: EnhancedError): Promise<void> {
    const message = `Persistent error detected: ${enhancedError.originalError.message}`;
    
    try {
      // Try to send desktop notification
      await this.notificationService.sendNotification([], {
        desktop: true,
        audio: true,
        logFile: true
      });
      
      console.error(`🚨 PERSISTENT ERROR: ${message}`);
      console.error('This error has occurred multiple times and may require manual intervention.');
      
    } catch (notificationError) {
      console.error('Failed to send persistent error notification:', notificationError);
    }
    
    this.emit('persistent-error', enhancedError);
  }

  /**
   * Log error with full context and stack trace
   */
  private async logErrorWithContext(enhancedError: EnhancedError): Promise<void> {
    const logEntry = {
      timestamp: enhancedError.context.timestamp,
      type: enhancedError.type,
      severity: enhancedError.severity,
      message: enhancedError.originalError.message,
      stack: enhancedError.originalError.stack,
      context: enhancedError.context,
      attemptCount: enhancedError.attemptCount,
      canRecover: enhancedError.canRecover
    };
    
    // Log to status logger
    await this.statusLogger.logError(enhancedError.originalError, 
      `${enhancedError.context.operation} in ${enhancedError.context.component}`);
    
    // Log to dedicated error file
    await this.logToErrorFile(logEntry);
  }

  /**
   * Log to dedicated error file with structured format
   */
  private async logToErrorFile(logEntry: any): Promise<void> {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.errorLogPath, logLine, 'utf8');
    } catch (fileError) {
      console.error('Failed to write to error log file:', fileError);
    }
  }

  /**
   * Generate unique key for error tracking
   */
  private getErrorKey(error: Error, context: ErrorContext): string {
    return `${context.component}:${context.operation}:${error.message}`;
  }

  /**
   * Ensure error log directory exists
   */
  private async ensureErrorLogDirectory(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.errorLogPath));
    } catch (error) {
      console.error('Failed to create error log directory:', error);
    }
  } 
 /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recoverySuccessRate: number;
    persistentErrors: number;
  } {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      persistentErrors: 0
    };
    
    // Initialize counters
    Object.values(ErrorType).forEach(type => stats.errorsByType[type] = 0);
    Object.values(ErrorSeverity).forEach(severity => stats.errorsBySeverity[severity] = 0);
    
    let recoveredErrors = 0;
    
    this.errorHistory.forEach(error => {
      stats.errorsByType[error.type]++;
      stats.errorsBySeverity[error.severity]++;
      
      if (error.canRecover && error.attemptCount > 0) {
        recoveredErrors++;
      }
      
      if (error.attemptCount >= this.persistentErrorThreshold) {
        stats.persistentErrors++;
      }
    });
    
    stats.recoverySuccessRate = this.errorHistory.length > 0 ? 
      (recoveredErrors / this.errorHistory.length) * 100 : 0;
    
    return stats;
  }

  /**
   * Clear error history and recovery attempts
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.recoveryAttempts.clear();
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): EnhancedError[] {
    return this.errorHistory
      .slice(-limit)
      .sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime());
  }

  /**
   * Export error logs
   */
  async exportErrorLogs(outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(path.dirname(this.errorLogPath), `error-export-${timestamp}.json`);
    const exportPath = outputPath || defaultPath;
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      statistics: this.getErrorStatistics(),
      errors: this.errorHistory.map(error => ({
        timestamp: error.context.timestamp,
        type: error.type,
        severity: error.severity,
        message: error.originalError.message,
        stack: error.originalError.stack,
        context: error.context,
        attemptCount: error.attemptCount,
        canRecover: error.canRecover
      }))
    };
    
    await fs.writeJson(exportPath, exportData, { spaces: 2 });
    return exportPath;
  }
}