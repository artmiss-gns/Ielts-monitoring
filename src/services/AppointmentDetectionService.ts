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
  notificationTrackingFile: string; // Separate file for notification tracking
  maxTrackingDays: number;
  statusChangeThreshold: number; // Minutes to wait before considering a status change permanent
}

/**
 * Enhanced appointment detection service with duplicate prevention and status tracking
 */
export class AppointmentDetectionService {
  private config: DetectionConfig;
  private trackedAppointments: Map<string, TrackedAppointment> = new Map();
  private notifiedAppointmentKeys: Map<string, Date> = new Map(); // Track notified appointments by key

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      trackingDataFile: 'data/appointment-tracking.json',
      notificationTrackingFile: 'data/notified-appointments.json',
      maxTrackingDays: 30,
      statusChangeThreshold: 5,
      ...config
    };
  }

  /**
   * Generate a unique key for an appointment based on its core attributes
   * Format: ${date}-${time}-${location}-${examType}
   */
  public generateAppointmentKey(appointment: Appointment): string {
    const date = appointment.date;
    const time = appointment.time;
    const location = appointment.location || appointment.city;
    const examType = appointment.examType;
    
    return `${date}-${time}-${location}-${examType}`;
  }

  /**
   * Initialize the service by loading existing tracking data
   */
  async initialize(): Promise<void> {
    await this.loadTrackingData();
    await this.loadNotificationTrackingData();
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
          
          const appointmentKey = this.generateAppointmentKey(appointment);
          console.log(`🔄 Status change detected for ${appointmentKey}: ${previousStatus} → ${currentStatus}`);
          
          // Enhanced logging for notification decision impact
          if (previousStatus !== 'available' && currentStatus === 'available') {
            newAvailableAppointments.push(appointment);
            console.log(`✨ Appointment became available again: ${appointmentKey} - eligible for re-notification`);
            
            // Check if this was previously notified
            if (this.notifiedAppointmentKeys.has(appointmentKey)) {
              console.log(`🔄 Previously notified appointment became available again: ${appointmentKey}`);
            }
          } else if (previousStatus === 'available' && currentStatus !== 'available') {
            console.log(`📉 Appointment became unavailable: ${appointmentKey} - future availability may trigger re-notification`);
          } else {
            console.log(`🔄 Status transition (non-availability related): ${appointmentKey} - ${previousStatus} → ${currentStatus}`);
          }
          
          statusChangedAppointments.push(appointment);
        } else {
          // Status unchanged, just update the appointment data
          existingTracked.appointment = appointment;
          
          // Log if this is a continuously available appointment that might be filtered out
          if (currentStatus === 'available') {
            const appointmentKey = this.generateAppointmentKey(appointment);
            if (this.notifiedAppointmentKeys.has(appointmentKey)) {
              console.log(`⏸️ Appointment remains available (no status change): ${appointmentKey} - will be filtered from notifications`);
            }
          }
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
   * Records appointment keys to prevent duplicate notifications
   */
  async markAsNotified(appointments: Appointment[]): Promise<void> {
    const currentTime = new Date();
    
    for (const appointment of appointments) {
      const appointmentKey = this.generateAppointmentKey(appointment);
      const wasAlreadyNotified = this.notifiedAppointmentKeys.has(appointmentKey);
      
      this.notifiedAppointmentKeys.set(appointmentKey, currentTime);
      
      // Also update the existing tracking system
      const tracked = this.trackedAppointments.get(appointment.id);
      if (tracked) {
        tracked.notificationsSent++;
        
        // Log notification decision context
        if (wasAlreadyNotified) {
          console.log(`🔄 Re-notification sent for appointment: ${appointmentKey} (total notifications: ${tracked.notificationsSent})`);
          
          // Log the reason for re-notification based on status history
          const recentStatusChanges = tracked.statusHistory.filter(change => 
            change.timestamp > (this.notifiedAppointmentKeys.get(appointmentKey) || new Date(0))
          );
          
          if (recentStatusChanges.length > 0) {
            console.log(`📊 Status changes since last notification: ${recentStatusChanges.map(c => `${c.previousStatus}→${c.newStatus}`).join(', ')}`);
          }
        } else {
          console.log(`✅ First notification sent for appointment: ${appointmentKey}`);
        }
      } else {
        console.log(`✅ Marked as notified (no tracking data): ${appointmentKey}`);
      }
    }
    
    await this.saveTrackingData();
    await this.saveNotificationTrackingData();
  }

  /**
   * Get appointments that should be notified (available and not recently notified)
   * Uses appointment keys and status transition logic to prevent duplicate notifications
   * while allowing re-notification when appointments become available again
   */
  getNotifiableAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.filter(appointment => {
      // Only notify available appointments
      if (appointment.status !== 'available') {
        console.log(`🚫 Skipping non-available appointment: ${appointment.date} ${appointment.time} (status: ${appointment.status})`);
        return false;
      }
      
      const appointmentKey = this.generateAppointmentKey(appointment);
      const trackedAppointment = this.trackedAppointments.get(appointment.id);
      
      // If we have tracking data for this appointment, use status transition logic
      if (trackedAppointment) {
        const shouldNotify = this.shouldNotifyBasedOnStatusTransitions(trackedAppointment, appointmentKey);
        if (shouldNotify) {
          console.log(`🔔 Appointment available for notification (status transition): ${appointmentKey}`);
        } else {
          console.log(`🔕 Skipping notification (already notified, no status change): ${appointmentKey}`);
        }
        return shouldNotify;
      }
      
      // For new appointments (not tracked yet), check simple notification key logic
      if (this.notifiedAppointmentKeys.has(appointmentKey)) {
        console.log(`🔕 Skipping duplicate notification for new appointment: ${appointmentKey}`);
        return false;
      }
      
      console.log(`🔔 New appointment available for notification: ${appointmentKey}`);
      return true;
    });
  }

  /**
   * Determine if an appointment should be notified based on its status transition history
   * Allows re-notification when appointments become available again after being unavailable
   */
  private shouldNotifyBasedOnStatusTransitions(trackedAppointment: TrackedAppointment, appointmentKey: string): boolean {
    const currentStatus = trackedAppointment.appointment.status;
    const statusHistory = trackedAppointment.statusHistory;
    
    // If appointment is not available, never notify
    if (currentStatus !== 'available') {
      return false;
    }
    
    // If we've never notified about this appointment key, we can notify
    if (!this.notifiedAppointmentKeys.has(appointmentKey)) {
      console.log(`📝 No previous notification found for key: ${appointmentKey}`);
      return true;
    }
    
    // Get the last notification timestamp for this key
    const lastNotificationTime = this.notifiedAppointmentKeys.get(appointmentKey)!;
    
    // Check if the appointment went unavailable and then became available again after the last notification
    const statusChangesAfterNotification = statusHistory.filter(change => 
      change.timestamp > lastNotificationTime
    );
    
    // Look for a pattern: available -> unavailable -> available
    let wentUnavailable = false;
    let becameAvailableAgain = false;
    
    for (const change of statusChangesAfterNotification) {
      if (change.previousStatus === 'available' && change.newStatus !== 'available') {
        wentUnavailable = true;
        console.log(`📉 Appointment went unavailable after notification: ${appointmentKey} at ${change.timestamp.toISOString()}`);
      } else if (wentUnavailable && change.previousStatus !== 'available' && change.newStatus === 'available') {
        becameAvailableAgain = true;
        console.log(`📈 Appointment became available again: ${appointmentKey} at ${change.timestamp.toISOString()}`);
        break;
      }
    }
    
    if (wentUnavailable && becameAvailableAgain) {
      console.log(`🔄 Appointment eligible for re-notification due to status transition: ${appointmentKey}`);
      return true;
    }
    
    // If appointment has been continuously available since last notification, don't notify again
    console.log(`⏸️ Appointment remains available since last notification: ${appointmentKey}`);
    return false;
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
    notifiedAppointmentKeysCount: number;
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
      averageTrackingDuration: tracked.length > 0 ? totalTrackingDuration / tracked.length : 0,
      notifiedAppointmentKeysCount: this.notifiedAppointmentKeys.size
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
      
      // Load tracked appointments
      if (trackingData.trackedAppointments) {
        for (const [id, tracked] of Object.entries(trackingData.trackedAppointments)) {
          const trackedAppointment = tracked as any;
          trackedAppointment.firstSeen = new Date(trackedAppointment.firstSeen);
          trackedAppointment.lastSeen = new Date(trackedAppointment.lastSeen);
          trackedAppointment.statusHistory = trackedAppointment.statusHistory.map((change: any) => ({
            ...change,
            timestamp: new Date(change.timestamp)
          }));
          
          this.trackedAppointments.set(id, trackedAppointment as TrackedAppointment);
        }
      } else {
        // Legacy format - convert old data
        for (const [id, tracked] of Object.entries(trackingData)) {
          if (typeof tracked === 'object' && tracked !== null && 'appointment' in tracked) {
            const trackedAppointment = tracked as any;
            trackedAppointment.firstSeen = new Date(trackedAppointment.firstSeen);
            trackedAppointment.lastSeen = new Date(trackedAppointment.lastSeen);
            trackedAppointment.statusHistory = trackedAppointment.statusHistory.map((change: any) => ({
              ...change,
              timestamp: new Date(change.timestamp)
            }));
            
            this.trackedAppointments.set(id, trackedAppointment as TrackedAppointment);
          }
        }
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

      const trackingData = {
        trackedAppointments: Object.fromEntries(this.trackedAppointments.entries())
      };
      
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
   * Load notification tracking data from separate file
   */
  private async loadNotificationTrackingData(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.config.notificationTrackingFile);
      await fs.mkdir(dataDir, { recursive: true });

      const data = await fs.readFile(this.config.notificationTrackingFile, 'utf-8');
      const notificationData = JSON.parse(data);
      
      // Load notified appointment keys
      if (notificationData.notifiedAppointmentKeys) {
        for (const [key, timestamp] of Object.entries(notificationData.notifiedAppointmentKeys)) {
          this.notifiedAppointmentKeys.set(key, new Date(timestamp as string));
        }
      }
      
      console.log(`🔔 Loaded notification tracking data for ${this.notifiedAppointmentKeys.size} notified appointment keys`);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.log(`🔔 Starting with fresh notification tracking data`);
      this.notifiedAppointmentKeys.clear();
    }
  }

  /**
   * Save notification tracking data to separate file
   */
  private async saveNotificationTrackingData(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.config.notificationTrackingFile);
      await fs.mkdir(dataDir, { recursive: true });

      const notificationData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        notifiedAppointmentKeys: Object.fromEntries(this.notifiedAppointmentKeys.entries())
      };
      
      await fs.writeFile(
        this.config.notificationTrackingFile, 
        JSON.stringify(notificationData, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save notification tracking data:', error);
      // Graceful fallback - continue with in-memory tracking
      console.log('🔄 Continuing with in-memory notification tracking');
    }
  }

  /**
   * Clean up old tracking data
   */
  private async cleanupOldTracking(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxTrackingDays);
    
    let removedTrackingCount = 0;
    for (const [id, tracked] of this.trackedAppointments.entries()) {
      if (tracked.lastSeen < cutoffDate) {
        this.trackedAppointments.delete(id);
        removedTrackingCount++;
      }
    }
    
    let removedNotificationCount = 0;
    for (const [key, timestamp] of this.notifiedAppointmentKeys.entries()) {
      if (timestamp < cutoffDate) {
        this.notifiedAppointmentKeys.delete(key);
        removedNotificationCount++;
      }
    }
    
    if (removedTrackingCount > 0) {
      console.log(`🧹 Cleaned up ${removedTrackingCount} old appointment tracking records`);
      await this.saveTrackingData();
    }
    
    if (removedNotificationCount > 0) {
      console.log(`🧹 Cleaned up ${removedNotificationCount} old notification keys`);
      await this.saveNotificationTrackingData();
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

  /**
   * Get detailed notification decision information for debugging
   * Provides insight into why appointments were or were not notified
   */
  getNotificationDecisionDetails(appointments: Appointment[]): Array<{
    appointment: Appointment;
    appointmentKey: string;
    shouldNotify: boolean;
    reason: string;
    statusHistory?: AppointmentStatusChange[] | undefined;
    lastNotificationTime?: Date | undefined;
    notificationCount: number;
  }> {
    return appointments.map(appointment => {
      const appointmentKey = this.generateAppointmentKey(appointment);
      const trackedAppointment = this.trackedAppointments.get(appointment.id);
      const lastNotificationTime = this.notifiedAppointmentKeys.get(appointmentKey);
      
      let shouldNotify = false;
      let reason = '';
      let notificationCount = 0;
      
      if (appointment.status !== 'available') {
        reason = `Appointment status is '${appointment.status}', not 'available'`;
      } else if (trackedAppointment) {
        notificationCount = trackedAppointment.notificationsSent;
        shouldNotify = this.shouldNotifyBasedOnStatusTransitions(trackedAppointment, appointmentKey);
        
        if (shouldNotify) {
          if (!lastNotificationTime) {
            reason = 'New available appointment, never notified before';
          } else {
            const statusChangesAfterNotification = trackedAppointment.statusHistory.filter(change => 
              change.timestamp > lastNotificationTime
            );
            
            let wentUnavailable = false;
            let becameAvailableAgain = false;
            
            for (const change of statusChangesAfterNotification) {
              if (change.previousStatus === 'available' && change.newStatus !== 'available') {
                wentUnavailable = true;
              } else if (wentUnavailable && change.previousStatus !== 'available' && change.newStatus === 'available') {
                becameAvailableAgain = true;
                break;
              }
            }
            
            if (wentUnavailable && becameAvailableAgain) {
              reason = 'Appointment became available again after being unavailable';
            } else {
              reason = 'Available appointment with status transition history';
            }
          }
        } else {
          if (!lastNotificationTime) {
            reason = 'Available appointment, but notification logic prevented it';
          } else {
            reason = 'Already notified and no qualifying status transitions occurred';
          }
        }
      } else {
        // New appointment not tracked yet
        if (lastNotificationTime) {
          reason = 'New appointment but key was previously notified';
        } else {
          shouldNotify = true;
          reason = 'New available appointment';
        }
      }
      
      return {
        appointment,
        appointmentKey,
        shouldNotify,
        reason,
        statusHistory: trackedAppointment?.statusHistory || undefined,
        lastNotificationTime: lastNotificationTime || undefined,
        notificationCount
      };
    });
  }
}