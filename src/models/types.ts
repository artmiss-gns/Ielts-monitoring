/**
 * Core data models and interfaces for IELTS Appointment Monitor
 */

/**
 * Represents an IELTS appointment slot
 */
export interface Appointment {
  id: string;
  date: string; // ISO date format (YYYY-MM-DD)
  time: string; // Time range (e.g., "09:00-12:00")
  location: string;
  examType: string;
  city: string;
  status: 'available' | 'filled' | 'pending' | 'not-registerable' | 'unknown';
  price?: number;
  registrationUrl?: string;
  rawHtml?: string; // Raw HTML for inspection purposes
}

/**
 * Represents a monitoring session with statistics
 */
export interface MonitoringSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  checksPerformed: number;
  notificationsSent: number;
  errors: ErrorLog[];
  configuration: MonitorConfig;
}

/**
 * Represents a notification record
 */
export interface NotificationRecord {
  timestamp: Date;
  appointmentCount: number;
  appointments: Appointment[];
  channels: string[]; // ['desktop', 'audio', 'log']
  deliveryStatus: 'success' | 'partial' | 'failed';
}

/**
 * Error log entry
 */
export interface ErrorLog {
  timestamp: Date;
  error: string;
  context?: string;
  stack?: string;
}

/**
 * Monitor configuration
 */
export interface MonitorConfig {
  city: string[];
  examModel: string[];
  months: number[];
  checkInterval: number;
  notificationSettings: NotificationSettings;
  baseUrl?: string; // Optional base URL for testing (defaults to irsafam.org)
  security?: SecurityConfig;
  server?: ServerConfig;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  desktop: boolean;
  audio: boolean;
  logFile: boolean;
  telegram?: boolean;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enableSecureLogging: boolean;
  maskSensitiveData: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Server configuration
 */
export interface ServerConfig {
  enableHealthCheck: boolean;
  healthCheckPort?: number;
  enableMetrics: boolean;
}

/**
 * Telegram notification configuration
 */
export interface TelegramConfig {
  botToken: string;
  chatId: string; // Can be channel ID (@channelname or -100xxxxxxxxx) or private chat ID
  messageFormat: 'simple' | 'detailed';
  enablePreview: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  isChannel?: boolean; // Indicates if chatId is a channel
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  telegramBotToken?: string | undefined;
  telegramChatId?: string | undefined;
  monitorCheckInterval?: number | undefined;
  monitorCities?: string[] | undefined;
  monitorExamModels?: string[] | undefined;
  monitorMonths?: number[] | undefined;
  monitorBaseUrl?: string | undefined;
  logLevel?: string | undefined;
  enableSecureLogging?: boolean | undefined;
  maskSensitiveData?: boolean | undefined;
  healthCheckPort?: number | undefined;
  enableMetrics?: boolean | undefined;
}

/**
 * Appointment comparison result
 */
export interface AppointmentComparison {
  newAppointments: Appointment[];
  removedAppointments: Appointment[];
  unchangedAppointments: Appointment[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Enhanced check result with detailed appointment status information
 */
export interface CheckResult {
  type: 'available' | 'filled' | 'no-slots';
  appointmentCount: number;
  availableCount: number;
  filledCount: number;
  timestamp: Date;
  url: string;
  appointments: Appointment[];
}

/**
 * Enhanced status detection result with detailed reasoning
 */
export interface StatusDetectionResult {
  status: 'available' | 'filled' | 'pending' | 'not-registerable' | 'unknown';
  confidence: number; // 0-1 confidence score
  indicators: StatusIndicator[];
  reasoning: string;
  fallbackUsed: boolean;
}

/**
 * Status indicator found during detection
 */
export interface StatusIndicator {
  type: 'css-class' | 'text-content' | 'interactive-element' | 'contextual';
  value: string;
  weight: number; // Importance weight
  source: 'element' | 'sibling' | 'parent';
}

/**
 * Detection strategy result
 */
export interface DetectionStrategy {
  name: string;
  priority: number;
  selectors: string[];
  elementsFound: number;
  successRate: number;
  processingTime: number;
}

/**
 * Enhanced appointment with detection metadata
 */
export interface EnhancedAppointment extends Appointment {
  // Detection metadata
  detectionMethod: string;
  statusIndicators: string[];
  confidenceScore: number;
  parsingNotes: string[];
  elementIndex: number;
}

/**
 * Inspection data for debugging and verification
 */
export interface InspectionData {
  url: string;
  pageTitle: string;
  detectedElements: string[];
  parsingNotes: string;
  rawAppointmentHtml: string[];
  checkResult: CheckResult;
}

/**
 * Enhanced inspection data with detailed status detection reasoning
 */
export interface EnhancedInspectionData extends InspectionData {
  // Enhanced detection details
  detectionStrategies: DetectionStrategy[];
  statusDecisions: {
    elementIndex: number;
    finalStatus: string;
    indicators: StatusIndicator[];
    reasoning: string;
    confidenceScore: number;
    rawHtml: string;
  }[];
  
  // Selector analysis
  selectorResults: {
    selector: string;
    elementCount: number;
    strategy: string;
    sampleHtml?: string;
  }[];
  
  // Validation results
  validationChecks: {
    check: string;
    passed: boolean;
    details: string;
  }[];
  
  // Error tracking
  errorLog: {
    timestamp: Date;
    error: string;
    context: string;
    elementIndex?: number;
  }[];
  
  // Performance metrics
  performanceMetrics: {
    totalProcessingTime: number;
    elementDetectionTime: number;
    statusDetectionTime: number;
    parsingTime: number;
  };
}