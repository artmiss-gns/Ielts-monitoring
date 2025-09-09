import { EventEmitter } from 'events';
import { 
  MonitorConfig, 
  MonitoringSession, 
  Appointment, 
  ErrorLog 
} from '../models/types';
import { ConfigurationManager } from './ConfigurationManager';
import { WebScraperService } from './WebScraperService';
import { DataStorageService } from './DataStorageService';
import { NotificationService } from './NotificationService';
import { StatusLoggerService, MonitoringStatistics } from './StatusLoggerService';
import { ErrorHandlerService } from './ErrorHandlerService';
import { generateId } from '../models/utils';

/**
 * Monitor status enumeration
 */
export enum MonitorStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * Monitor Controller events
 */
export interface MonitorControllerEvents {
  'status-changed': (status: MonitorStatus) => void;
  'appointments-found': (appointments: Appointment[]) => void;
  'new-appointments': (appointments: Appointment[]) => void;
  'check-completed': (appointmentCount: number) => void;
  'error': (error: Error) => void;
  'notification-sent': (appointmentCount: number) => void;
}

/**
 * Monitor Controller class - Central orchestrator for IELTS appointment monitoring
 */
export class MonitorController extends EventEmitter {
  private status: MonitorStatus = MonitorStatus.STOPPED;
  private currentSession: MonitoringSession | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private config: MonitorConfig | null = null;
  private isShuttingDown: boolean = false;

  // Service dependencies
  private configManager: ConfigurationManager;
  private webScraper: WebScraperService;
  private dataStorage: DataStorageService;
  private notificationService: NotificationService;
  private statusLogger: StatusLoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(options?: { skipShutdownHandlers?: boolean; baseUrl?: string }) {
    super();
    
    // Initialize services
    this.configManager = new ConfigurationManager();
    this.webScraper = new WebScraperService(options?.baseUrl);
    this.dataStorage = new DataStorageService();
    this.notificationService = new NotificationService();
    this.statusLogger = new StatusLoggerService();
    this.errorHandler = new ErrorHandlerService(this.statusLogger, this.notificationService);

    // Setup graceful shutdown handlers (skip in tests)
    if (!options?.skipShutdownHandlers) {
      this.setupShutdownHandlers();
    }
  }

  /**
   * Start monitoring with the provided or loaded configuration
   */
  async startMonitoring(config?: MonitorConfig): Promise<void> {
    if (this.status === MonitorStatus.RUNNING) {
      throw new Error('Monitoring is already running');
    }

    try {
      this.setStatus(MonitorStatus.STARTING);
      
      // Load or use provided configuration
      this.config = config || await this.configManager.loadConfig();
      
      // Reinitialize WebScraperService with baseUrl from config if provided
      if (this.config.baseUrl) {
        this.webScraper = new WebScraperService(this.config.baseUrl);
      }
      
      // Initialize services
      await this.initializeServices();
      
      // Create new monitoring session
      this.currentSession = {
        sessionId: generateId(),
        startTime: new Date(),
        checksPerformed: 0,
        notificationsSent: 0,
        errors: [],
        configuration: this.config
      };

      // Start status logging
      await this.statusLogger.startSession(this.currentSession.sessionId, this.config);
      
      // Start monitoring loop
      this.startMonitoringLoop();
      
      this.setStatus(MonitorStatus.RUNNING);
      await this.statusLogger.logInfo('Monitoring started', { 
        sessionId: this.currentSession.sessionId,
        config: this.config 
      });
      
    } catch (error) {
      this.setStatus(MonitorStatus.ERROR);
      await this.handleError(error as Error, 'Failed to start monitoring');
      throw error;
    }
  }

  /**
   * Pause monitoring temporarily
   */
  async pauseMonitoring(): Promise<void> {
    if (this.status !== MonitorStatus.RUNNING) {
      throw new Error('Cannot pause monitoring - not currently running');
    }

    this.setStatus(MonitorStatus.PAUSED);
    
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    await this.statusLogger.logInfo('Monitoring paused', { 
      sessionId: this.currentSession?.sessionId 
    });
  }

  /**
   * Resume monitoring from paused state
   */
  async resumeMonitoring(): Promise<void> {
    if (this.status !== MonitorStatus.PAUSED) {
      throw new Error('Cannot resume monitoring - not currently paused');
    }

    this.setStatus(MonitorStatus.RUNNING);
    this.startMonitoringLoop();
    
    await this.statusLogger.logInfo('Monitoring resumed', { 
      sessionId: this.currentSession?.sessionId 
    });
  }

  /**
   * Stop monitoring gracefully
   */
  async stopMonitoring(): Promise<void> {
    if (this.status === MonitorStatus.STOPPED) {
      return;
    }

    this.setStatus(MonitorStatus.STOPPING);
    this.isShuttingDown = true;

    // Clear monitoring timer
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Finalize current session
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      await this.statusLogger.endSession();
    }

    // Cleanup services
    await this.cleanupServices();

    this.setStatus(MonitorStatus.STOPPED);
    await this.statusLogger.logInfo('Monitoring stopped', { 
      sessionId: this.currentSession?.sessionId 
    });

    this.currentSession = null;
    this.isShuttingDown = false;
  }  /**
   * 
Get current monitoring status and statistics
   */
  async getStatus(): Promise<{
    status: MonitorStatus;
    statistics?: MonitoringStatistics;
    session?: MonitoringSession;
    config?: MonitorConfig;
  }> {
    const result: any = {
      status: this.status
    };

    if (this.currentSession) {
      result.session = { ...this.currentSession };
      result.statistics = await this.statusLogger.getStatistics();
    }

    if (this.config) {
      result.config = { ...this.config };
    }

    return result;
  }

  /**
   * Update configuration and restart monitoring if running
   */
  async updateConfiguration(newConfig: MonitorConfig): Promise<void> {
    const wasRunning = this.status === MonitorStatus.RUNNING;
    
    if (wasRunning) {
      await this.pauseMonitoring();
    }

    // Validate and save new configuration
    await this.configManager.saveConfig(newConfig);
    this.config = newConfig;

    if (wasRunning) {
      await this.resumeMonitoring();
    }

    await this.statusLogger.logInfo('Configuration updated', { 
      sessionId: this.currentSession?.sessionId,
      newConfig 
    });
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    try {
      await this.webScraper.initialize();
      await this.statusLogger.logInfo('Services initialized successfully');
    } catch (error) {
      await this.statusLogger.logError(error as Error, 'Failed to initialize services');
      throw error;
    }
  }

  /**
   * Cleanup services on shutdown
   */
  private async cleanupServices(): Promise<void> {
    try {
      await this.webScraper.close();
      await this.statusLogger.logInfo('Services cleaned up successfully');
    } catch (error) {
      await this.statusLogger.logError(error as Error, 'Error during service cleanup');
    }
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoringLoop(): void {
    if (!this.config || this.isShuttingDown) {
      return;
    }

    const performCheck = async () => {
      if (this.status !== MonitorStatus.RUNNING || this.isShuttingDown) {
        return;
      }

      try {
        await this.performMonitoringCheck();
      } catch (error) {
        await this.handleError(error as Error, 'Error during monitoring check');
      }

      // Schedule next check
      if (this.status === MonitorStatus.RUNNING && !this.isShuttingDown) {
        this.monitoringTimer = setTimeout(performCheck, this.config!.checkInterval);
      }
    };

    // Start first check immediately
    setImmediate(performCheck);
  }

  /**
   * Perform a single monitoring check
   */
  private async performMonitoringCheck(): Promise<void> {
    if (!this.config || !this.currentSession) {
      return;
    }

    const checkStartTime = new Date();
    console.log(`\n🔄 [${checkStartTime.toLocaleTimeString()}] Starting monitoring check #${this.currentSession.checksPerformed + 1}`);

    try {
      // Fetch current appointments
      const filters = {
        city: this.config.city,
        examModel: this.config.examModel,
        months: this.config.months
      };

      const currentAppointments = await this.webScraper.fetchAppointments(filters);
      this.emit('appointments-found', currentAppointments);

      // Get previous appointments for comparison
      const previousAppointments = await this.dataStorage.getLastAppointments();
      
      // Detect new appointments
      const comparison = this.dataStorage.detectNewAppointments(
        currentAppointments, 
        previousAppointments || []
      );

      // Save current appointments
      await this.dataStorage.saveAppointments(currentAppointments);

      // Update session statistics
      this.currentSession.checksPerformed++;
      
      // Enhanced logging for comparison results
      const checkEndTime = new Date();
      const duration = checkEndTime.getTime() - checkStartTime.getTime();
      
      console.log(`✅ [${checkEndTime.toLocaleTimeString()}] Check completed in ${duration}ms`);
      
      if (comparison.newAppointments.length > 0) {
        console.log(`🎉 Found ${comparison.newAppointments.length} NEW appointment(s)!`);
        comparison.newAppointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.examType})`);
        });
      } else if (currentAppointments.length === 0) {
        console.log(`📭 No appointments available - all time slots are filled`);
      } else {
        console.log(`📋 ${currentAppointments.length} appointment(s) found (no new ones)`);
      }
      
      if (comparison.removedAppointments.length > 0) {
        console.log(`📤 ${comparison.removedAppointments.length} appointment(s) were removed since last check`);
      }
      
      // Log the check
      await this.statusLogger.logCheck(currentAppointments.length);
      this.emit('check-completed', currentAppointments.length);

      // Send notifications for new appointments
      if (comparison.newAppointments.length > 0) {
        await this.sendNotifications(comparison.newAppointments);
        this.emit('new-appointments', comparison.newAppointments);
      }

      // Log next check time
      const nextCheckTime = new Date(Date.now() + this.config.checkInterval);
      console.log(`⏰ Next check scheduled for ${nextCheckTime.toLocaleTimeString()}`);

    } catch (error) {
      const checkEndTime = new Date();
      const duration = checkEndTime.getTime() - checkStartTime.getTime();
      console.log(`❌ [${checkEndTime.toLocaleTimeString()}] Check failed after ${duration}ms`);
      await this.handleError(error as Error, 'Monitoring check failed');
    }
  }

  /**
   * Send notifications for new appointments
   */
  private async sendNotifications(appointments: Appointment[]): Promise<void> {
    if (!this.config || !this.currentSession) {
      return;
    }

    try {
      const notificationRecord = await this.notificationService.sendNotification(
        appointments,
        this.config.notificationSettings
      );

      // Update session statistics
      this.currentSession.notificationsSent++;
      
      await this.statusLogger.logNotification(notificationRecord);
      this.emit('notification-sent', appointments.length);

    } catch (error) {
      await this.handleError(error as Error, 'Failed to send notifications');
    }
  }

  /**
   * Handle errors with logging and recovery using ErrorHandlerService
   */
  private async handleError(error: Error, context: string): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      error: error.message,
      context,
      ...(error.stack && { stack: error.stack })
    };

    // Add to session errors
    if (this.currentSession) {
      this.currentSession.errors.push(errorLog);
    }

    // Use enhanced error handling
    const enhancedError = this.errorHandler.enhanceError(error, {
      operation: context,
      component: 'MonitorController',
      timestamp: new Date(),
      ...(this.currentSession?.sessionId && { sessionId: this.currentSession.sessionId })
    });

    const recovered = await this.errorHandler.handleError(enhancedError);
    
    // Emit error event
    this.emit('error', error);

    // If not recovered and critical, stop monitoring
    if (!recovered && enhancedError.severity === 'critical') {
      await this.stopMonitoring();
      this.setStatus(MonitorStatus.ERROR);
    }
  }



  /**
   * Set monitoring status and emit event
   */
  private setStatus(newStatus: MonitorStatus): void {
    const oldStatus = this.status;
    this.status = newStatus;
    
    if (oldStatus !== newStatus) {
      this.emit('status-changed', newStatus);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      
      try {
        await this.stopMonitoring();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await this.statusLogger.logError(error, 'Uncaught exception');
      await this.stopMonitoring();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, _promise) => {
      const error = new Error(`Unhandled rejection: ${reason}`);
      await this.statusLogger.logError(error, 'Unhandled promise rejection');
      await this.stopMonitoring();
      process.exit(1);
    });
  }

  /**
   * Get current monitoring status
   */
  getCurrentStatus(): MonitorStatus {
    return this.status;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.status === MonitorStatus.RUNNING;
  }

  /**
   * Check if monitoring is paused
   */
  isPaused(): boolean {
    return this.status === MonitorStatus.PAUSED;
  }

  /**
   * Get current session information
   */
  getCurrentSession(): MonitoringSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Manually trigger a monitoring check (for testing)
   */
  async triggerCheck(): Promise<void> {
    if (this.status === MonitorStatus.RUNNING) {
      await this.performMonitoringCheck();
    }
  }
}