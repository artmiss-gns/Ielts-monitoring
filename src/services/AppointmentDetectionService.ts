import { Appointment, CheckResult } from '../models/types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Represents a tracked appointment with status history
 */
export interface TrackedAppointment {
  id: string;
  appointment: Appointment;
  firstSeen: Date;
  lastSeen: Date;
  statusHistory: AppointmentStatusChange[];
  notificationsSent: number;
}

/**
 * Represents a status change for an appointment
 */
export interface AppointmentStatusChange {
  timestamp: Date;
  previousStatus: string;
  newStatus: string;
  reason: string;
}

/**
 * Configuration for appointment detection
 */
export interface DetectionConfig {
  trackingDataFile: string;
  maxTrackingDays: number;
  statusChangeThreshold: number; // Minutes to wait before considering a status change permanent
}

/**
 * Enhanced appointment detection service with duplicate prevention and status tracking
 */
export class AppointmentDetectionService {
  private config: DetectionConfig;
  private trackedAppointments: Map<string, TrackedAppointment> = new Map();

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      trackingDataFile: 'data/appointment-tracking.json',
      maxTrackingDays: 30,
      statusChangeThreshold: 5,
      ...config
    };
  }

  /**
   * Initialize the service by loading existing tracking data
   */
  async initialize(): Promise<void> {
    await this.loadTrackingData();
    await this.cleanupOldTracking();
  }

  /**
   * Process new appointments and detect changes
   */
  async processAppointments(checkResult: CheckResult): Promise<{
    newAvailableAppointments: Appointment[];
    statusChangedAppointments: Appointment[];
    removedAppointments: TrackedAppointment[];
    allTrackedAppointments: TrackedAppointment[];
  }> {
    const currentTime = new Date();
    const newAvailableAppointments: Appointment[] = [];
    const statusChangedAppointments: Appointment[] = [];
    const removedAppointments: TrackedAppointment[] = [];

    // Track which appointments we've seen in this check
    const seenAppointmentIds = new Set<string>();

    // Process each appointment from the current check
    for (const appointment of checkResult.appointments) {
      seenAppointmentIds.add(appointment.id);
      
      const existingTracked = this.trackedAppointments.get(appointment.id);
      
      if (!existingTracked) {
        // This is a new appointment
        const trackedAppointment: TrackedAppointment = {
          id: appointment.id,
          appointment: appointment,
          firstSeen: currentTime,
          lastSeen: currentTime,
          statusHistory: [{
            timestamp: currentTime,
            previousStatus: 'unknown',
            newStatus: appointment.status,
            reason: 'First detection'
          }],
          notificationsSent: 0
        };
        
        this.trackedAppointments.set(appointment.id, trackedAppointment);
        
        // Only add to new available if it's actually available
        if (appointment.status === 'available') {
          newAvailableAppointments.push(appointment);
          console.log(`🆕 New available appointment detected: ${appointment.date} ${appointment.time} - ${appointment.city}`);
        } else {
          console.log(`📋 New appointment detected (${appointment.status}): ${appointment.date} ${appointment.time} - ${appointment.city}`);
        }
      } else {
        // This is an existing appointment - check for status changes
        const previousStatus = existingTracked.appointment.status;
        const currentStatus = appointment.status;
        
        // Update last seen time
        existingTracked.lastSeen = currentTime;
        
        if (previousStatus !== currentStatus) {
          // Status has changed
          const statusChange: AppointmentStatusChange = {
            timestamp: currentTime,
            previousStatus: previousStatus,
            newStatus: currentStatus,
            reason: 'Status change detected'
          };
          
          existingTracked.statusHistory.push(statusChange);
          existingTracked.appointment = appointment; // Update with new status
          
          console.log(`🔄 Status change detected for ${appointment.date} ${appointment.time}: ${previousStatus} → ${currentStatus}`);
          
          // If it changed from non-available to available, treat as new available
          if (previousStatus !== 'available' && currentStatus === 'available') {
            newAvailableAppointments.push(appointment);
            console.log(`✨ Appointment became available again: ${appointment.date} ${appointment.time} - ${appointment.city}`);
          }
          
          statusChangedAppointments.push(appointment);
        } else {
          // Status unchanged, just update the appointment data
          existingTracked.appointment = appointment;
        }
      }
    }

    // Find appointments that are no longer present (removed)
    for (const [appointmentId, trackedAppointment] of this.trackedAppointments.entries()) {
      if (!seenAppointmentIds.has(appointmentId)) {
        // This appointment is no longer present
        removedAppointments.push(trackedAppointment);
        console.log(`📤 Appointment removed: ${trackedAppointment.appointment.date} ${trackedAppointment.appointment.time} - ${trackedAppointment.appointment.city}`);
      }
    }

    // Remove appointments that are no longer present
    for (const removedAppointment of removedAppointments) {
      this.trackedAppointments.delete(removedAppointment.id);
    }

    // Save updated tracking data
    await this.saveTrackingData();

    return {
      newAvailableAppointments,
      statusChangedAppointments,
      removedAppointments,
      allTrackedAppointments: Array.from(this.trackedAppointments.values())
    };
  }

  /**
   * Mark appointments as notified to prevent duplicate notifications
   */
  async markAsNotified(appointmentIds: string[]): Promise<void> {
    for (const appointmentId of appointmentIds) {
      const tracked = this.trackedAppointments.get(appointmentId);
      if (tracked) {
        tracked.notificationsSent++;
      }
    }
    await this.saveTrackingData();
  }

  /**
   * Get appointments that should be notified (available and not recently notified)
   */
  getNotifiableAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.filter(appointment => {
      // Only notify available appointments
      if (appointment.status !== 'available') {
        return false;
      }
      
      const tracked = this.trackedAppointments.get(appointment.id);
      
      // Always notify if not tracked yet and it's available
      if (!tracked) {
        return true;
      }
      
      // Check if we've already sent notifications for this appointment
      // For now, we only send one notification per appointment to avoid spam
      return tracked.notificationsSent === 0;
    });
  }

  /**
   * Get comprehensive statistics about tracked appointments
   */
  getTrackingStatistics(): {
    totalTracked: number;
    availableCount: number;
    filledCount: number;
    pendingCount: number;
    notRegistrableCount: number;
    unknownCount: number;
    totalNotificationsSent: number;
    averageTrackingDuration: number;
  } {
    const tracked = Array.from(this.trackedAppointments.values());
    const currentTime = new Date();
    
    let totalNotificationsSent = 0;
    let totalTrackingDuration = 0;
    
    const statusCounts = {
      available: 0,
      filled: 0,
      pending: 0,
      'not-registerable': 0,
      unknown: 0
    };

    for (const trackedAppointment of tracked) {
      const status = trackedAppointment.appointment.status;
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++;
      } else {
        statusCounts.unknown++;
      }
      
      totalNotificationsSent += trackedAppointment.notificationsSent;
      totalTrackingDuration += currentTime.getTime() - trackedAppointment.firstSeen.getTime();
    }

    return {
      totalTracked: tracked.length,
      availableCount: statusCounts.available,
      filledCount: statusCounts.filled,
      pendingCount: statusCounts.pending,
      notRegistrableCount: statusCounts['not-registerable'],
      unknownCount: statusCounts.unknown,
      totalNotificationsSent,
      averageTrackingDuration: tracked.length > 0 ? totalTrackingDuration / tracked.length : 0
    };
  }

  /**
   * Load tracking data from file
   */
  private async loadTrackingData(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.config.trackingDataFile);
      await fs.mkdir(dataDir, { recursive: true });

      const data = await fs.readFile(this.config.trackingDataFile, 'utf-8');
      const trackingData = JSON.parse(data);
      
      // Convert dates back from strings
      for (const [id, tracked] of Object.entries(trackingData)) {
        const trackedAppointment = tracked as any;
        trackedAppointment.firstSeen = new Date(trackedAppointment.firstSeen);
        trackedAppointment.lastSeen = new Date(trackedAppointment.lastSeen);
        trackedAppointment.statusHistory = trackedAppointment.statusHistory.map((change: any) => ({
          ...change,
          timestamp: new Date(change.timestamp)
        }));
        
        this.trackedAppointments.set(id, trackedAppointment as TrackedAppointment);
      }
      
      console.log(`📊 Loaded tracking data for ${this.trackedAppointments.size} appointments`);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.log(`📊 Starting with fresh appointment tracking data`);
      this.trackedAppointments.clear();
    }
  }

  /**
   * Save tracking data to file
   */
  private async saveTrackingData(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.config.trackingDataFile);
      await fs.mkdir(dataDir, { recursive: true });

      const trackingData = Object.fromEntries(this.trackedAppointments.entries());
      await fs.writeFile(
        this.config.trackingDataFile, 
        JSON.stringify(trackingData, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save tracking data:', error);
    }
  }

  /**
   * Clean up old tracking data
   */
  private async cleanupOldTracking(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxTrackingDays);
    
    let removedCount = 0;
    for (const [id, tracked] of this.trackedAppointments.entries()) {
      if (tracked.lastSeen < cutoffDate) {
        this.trackedAppointments.delete(id);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old appointment tracking records`);
      await this.saveTrackingData();
    }
  }

  /**
   * Get detailed status history for an appointment
   */
  getAppointmentHistory(appointmentId: string): TrackedAppointment | null {
    return this.trackedAppointments.get(appointmentId) || null;
  }

  /**
   * Get all appointments that have changed status recently
   */
  getRecentStatusChanges(minutesBack: number = 60): AppointmentStatusChange[] {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    const recentChanges: AppointmentStatusChange[] = [];
    
    for (const tracked of this.trackedAppointments.values()) {
      for (const change of tracked.statusHistory) {
        if (change.timestamp >= cutoffTime) {
          recentChanges.push(change);
        }
      }
    }
    
    return recentChanges.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}