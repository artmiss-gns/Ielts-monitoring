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
  status: 'available' | 'full' | 'pending';
  price?: number;
  registrationUrl?: string;
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
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  desktop: boolean;
  audio: boolean;
  logFile: boolean;
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