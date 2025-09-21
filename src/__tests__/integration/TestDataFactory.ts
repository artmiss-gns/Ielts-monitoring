import { 
  Appointment, 
  MonitorConfig, 
  NotificationSettings, 
  MonitoringSession,
  NotificationRecord,
  ErrorLog,
  TelegramConfig,
  EnvironmentConfig,
  AppointmentComparison,
  CheckResult,
  InspectionData,
  SecurityConfig,
  ServerConfig
} from '../../models/types';
import { generateId } from '../../models/utils';

/**
 * Enhanced factory for creating consistent test data across all test files
 */
export class TestDataFactory {
  /**
   * Create sample appointments for testing
   */
  static createAppointments(count: number = 3, options?: {
    city?: string;
    examType?: string;
    month?: number;
    status?: 'available' | 'filled' | 'pending';
  }): Appointment[] {
    const appointments: Appointment[] = [];
    const baseDate = new Date('2025-02-01');

    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i * 7); // Weekly intervals

      appointments.push({
        id: generateId(),
        date: date.toISOString().split('T')[0],
        time: i % 2 === 0 ? '09:00-12:00' : '14:00-17:00',
        location: `${options?.city || 'Isfahan'} Test Center ${i + 1}`,
        examType: options?.examType || 'CDIELTS',
        city: options?.city || 'isfahan',
        status: options?.status || 'available',
        price: 2500000 + (i * 100000),
        registrationUrl: `https://irsafam.org/register/${generateId()}`
      });
    }

    return appointments;
  }

  /**
   * Create a test monitor configuration
   */
  static createMonitorConfig(overrides?: Partial<MonitorConfig>): MonitorConfig {
    const defaultConfig: MonitorConfig = {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [2, 3, 4],
      checkInterval: 1000, // 1 second for fast testing
      notificationSettings: {
        desktop: false, // Disable for testing
        audio: false,   // Disable for testing
        logFile: true
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create notification settings for testing
   */
  static createNotificationSettings(overrides?: Partial<NotificationSettings>): NotificationSettings {
    const defaultSettings: NotificationSettings = {
      desktop: false,
      audio: false,
      logFile: true
    };

    return { ...defaultSettings, ...overrides };
  }

  /**
   * Create appointments with specific dates for month filtering tests
   */
  static createAppointmentsForMonths(months: number[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    months.forEach((month, index) => {
      const date = new Date(2025, month - 1, 15); // 15th of each month
      appointments.push({
        id: generateId(),
        date: date.toISOString().split('T')[0],
        time: '09:00-12:00',
        location: `Isfahan Test Center ${index + 1}`,
        examType: 'CDIELTS',
        city: 'isfahan',
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create appointments for different cities
   */
  static createAppointmentsForCities(cities: string[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    cities.forEach((city) => {
      appointments.push({
        id: generateId(),
        date: '2025-02-15',
        time: '09:00-12:00',
        location: `${city} Test Center`,
        examType: 'CDIELTS',
        city: city.toLowerCase(),
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create appointments for different exam types
   */
  static createAppointmentsForExamTypes(examTypes: string[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    examTypes.forEach((examType) => {
      appointments.push({
        id: generateId(),
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Test Center',
        examType: examType,
        city: 'isfahan',
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create a sequence of appointment changes for testing detection
   */
  static createAppointmentSequence(): {
    initial: Appointment[];
    updated: Appointment[];
    newAppointments: Appointment[];
  } {
    const initial = TestDataFactory.createAppointments(2);
    const newAppointment = TestDataFactory.createAppointments(1)[0];
    newAppointment.date = '2025-03-01';
    
    const updated = [...initial, newAppointment];

    return {
      initial,
      updated,
      newAppointments: [newAppointment]
    };
  }

  /**
   * Create test configuration with mock server URL
   */
  static createTestConfig(mockServerUrl: string, overrides?: Partial<MonitorConfig>): MonitorConfig {
    const config = TestDataFactory.createMonitorConfig(overrides);
    return {
      ...config,
      baseUrl: mockServerUrl,
      ...overrides
    };
  }

  /**
   * Create a monitoring session for testing
   */
  static createMonitoringSession(overrides?: Partial<MonitoringSession>): MonitoringSession {
    const defaultSession: MonitoringSession = {
      sessionId: generateId(),
      startTime: new Date(),
      checksPerformed: 5,
      notificationsSent: 2,
      errors: [],
      configuration: TestDataFactory.createMonitorConfig()
    };

    return { ...defaultSession, ...overrides };
  }

  /**
   * Create notification record for testing
   */
  static createNotificationRecord(overrides?: Partial<NotificationRecord>): NotificationRecord {
    const defaultRecord: NotificationRecord = {
      timestamp: new Date(),
      appointmentCount: 3,
      appointments: TestDataFactory.createAppointments(3),
      channels: ['desktop', 'log'],
      deliveryStatus: 'success'
    };

    return { ...defaultRecord, ...overrides };
  }

  /**
   * Create error log entry for testing
   */
  static createErrorLog(overrides?: Partial<ErrorLog>): ErrorLog {
    const defaultError: ErrorLog = {
      timestamp: new Date(),
      error: 'Test error message',
      context: 'Test context',
      stack: 'Error stack trace'
    };

    return { ...defaultError, ...overrides };
  }

  /**
   * Create Telegram configuration for testing
   */
  static createTelegramConfig(overrides?: Partial<TelegramConfig>): TelegramConfig {
    const defaultConfig: TelegramConfig = {
      botToken: 'test-bot-token',
      chatId: 'test-chat-id',
      messageFormat: 'simple',
      enablePreview: false,
      retryAttempts: 3,
      retryDelay: 1000,
      isChannel: false
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create environment configuration for testing
   */
  static createEnvironmentConfig(overrides?: Partial<EnvironmentConfig>): EnvironmentConfig {
    const defaultConfig: EnvironmentConfig = {
      telegramBotToken: 'test-bot-token',
      telegramChatId: 'test-chat-id',
      monitorCheckInterval: 30000,
      monitorCities: ['isfahan'],
      monitorExamModels: ['cdielts'],
      monitorMonths: [2, 3, 4],
      logLevel: 'info',
      enableSecureLogging: false,
      maskSensitiveData: true
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create appointment comparison result for testing
   */
  static createAppointmentComparison(overrides?: Partial<AppointmentComparison>): AppointmentComparison {
    const initial = TestDataFactory.createAppointments(2);
    const newAppointment = TestDataFactory.createAppointments(1)[0];
    
    const defaultComparison: AppointmentComparison = {
      newAppointments: [newAppointment],
      removedAppointments: [],
      unchangedAppointments: initial
    };

    return { ...defaultComparison, ...overrides };
  }

  /**
   * Create check result for testing
   */
  static createCheckResult(overrides?: Partial<CheckResult>): CheckResult {
    const appointments = TestDataFactory.createAppointments(3);
    
    const defaultResult: CheckResult = {
      type: 'available',
      appointmentCount: appointments.length,
      availableCount: appointments.filter(a => a.status === 'available').length,
      filledCount: appointments.filter(a => a.status === 'filled').length,
      timestamp: new Date(),
      url: 'https://irsafam.org/test',
      appointments
    };

    return { ...defaultResult, ...overrides };
  }

  /**
   * Create inspection data for testing
   */
  static createInspectionData(overrides?: Partial<InspectionData>): InspectionData {
    const checkResult = TestDataFactory.createCheckResult();
    
    const defaultInspection: InspectionData = {
      url: 'https://irsafam.org/test',
      pageTitle: 'Test Page Title',
      detectedElements: ['appointment-slot', 'date-picker', 'submit-button'],
      parsingNotes: 'Test parsing notes',
      rawAppointmentHtml: ['<div class="appointment">Test HTML</div>'],
      checkResult
    };

    return { ...defaultInspection, ...overrides };
  }

  /**
   * Create security configuration for testing
   */
  static createSecurityConfig(overrides?: Partial<SecurityConfig>): SecurityConfig {
    const defaultConfig: SecurityConfig = {
      enableSecureLogging: false,
      maskSensitiveData: true,
      logLevel: 'info'
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create server configuration for testing
   */
  static createServerConfig(overrides?: Partial<ServerConfig>): ServerConfig {
    const defaultConfig: ServerConfig = {
      enableHealthCheck: false,
      healthCheckPort: 3000,
      enableMetrics: false
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create appointments with different statuses for testing
   */
  static createAppointmentsWithStatuses(): Appointment[] {
    const statuses: Array<'available' | 'filled' | 'pending' | 'not-registerable' | 'unknown'> = 
      ['available', 'filled', 'pending', 'not-registerable', 'unknown'];
    
    return statuses.map((status, index) => ({
      id: generateId(),
      date: `2025-02-${String(index + 1).padStart(2, '0')}`,
      time: '09:00-12:00',
      location: `Isfahan Test Center ${index + 1}`,
      examType: 'CDIELTS',
      city: 'isfahan',
      status,
      price: 2500000
    }));
  }

  /**
   * Create mock statistics for testing
   */
  static createMockStatistics() {
    return {
      sessionId: generateId(),
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      uptime: 3600000, // 1 hour
      checksPerformed: 120,
      notificationsSent: 5,
      errorsEncountered: 1,
      averageCheckInterval: 30000,
      lastCheckTime: new Date(),
      lastNotificationTime: new Date(Date.now() - 600000) // 10 minutes ago
    };
  }

  /**
   * Create mock CLI command result
   */
  static createCLIResult(overrides?: {
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    command?: string;
  }) {
    return {
      exitCode: overrides?.exitCode ?? 0,
      stdout: overrides?.stdout ?? '',
      stderr: overrides?.stderr ?? '',
      command: overrides?.command ?? 'test-command',
      duration: 100
    };
  }

  /**
   * Create mock file system structure for testing
   */
  static createMockFileStructure() {
    return {
      'config/monitor-config.json': JSON.stringify(TestDataFactory.createMonitorConfig()),
      'data/appointments.json': JSON.stringify(TestDataFactory.createAppointments(3)),
      'data/notified-appointments.json': JSON.stringify([]),
      'logs/monitor.log': 'Test log content\n',
      'logs/errors.log': 'Test error log\n'
    };
  }
}