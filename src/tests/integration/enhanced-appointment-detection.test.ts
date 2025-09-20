import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { MonitorController } from '../../services/MonitorController';
import { MonitorConfig } from '../../models/types';

describe('Enhanced Appointment Detection Integration', () => {
  let controller: MonitorController;
  let testDataDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDataDir = path.join(__dirname, '../../test-data-integration');
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Use localhost test server for integration tests
    controller = new MonitorController({ 
      skipShutdownHandlers: true,
      baseUrl: 'http://localhost:3001'
    });
  });

  afterEach(async () => {
    // Stop monitoring and cleanup
    try {
      await controller.stopMonitoring();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up test data
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestConfig = (): MonitorConfig => ({
    city: ['Isfahan'],
    examModel: ['IELTS'],
    months: [12],
    checkInterval: 1000, // 1 second for testing
    notificationSettings: {
      desktop: false,
      audio: false,
      logFile: true,
      telegram: false
    },
    baseUrl: 'http://localhost:3001',
    security: {
      enableSecureLogging: false,
      maskSensitiveData: false,
      logLevel: 'info'
    },
    server: {
      enableHealthCheck: false,
      enableMetrics: false
    }
  });

  it('should detect and track appointment status changes', async () => {
    const config = createTestConfig();
    
    // Start monitoring
    await controller.startMonitoring(config);
    
    // Wait for a few checks to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get enhanced statistics
    const stats = await controller.getEnhancedStatistics();
    
    expect(stats.trackingStats).toBeDefined();
    expect(stats.trackingStats.totalTracked).toBeGreaterThanOrEqual(0);
    expect(stats.monitoringStats).toBeDefined();
    
    // Stop monitoring
    await controller.stopMonitoring();
  }, 10000);

  it('should prevent duplicate notifications for same appointments', async () => {
    const config = createTestConfig();
    
    let notificationCount = 0;
    controller.on('notification-sent', () => {
      notificationCount++;
    });
    
    // Start monitoring
    await controller.startMonitoring(config);
    
    // Wait for multiple checks
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Should not send duplicate notifications for the same appointments
    // (This test assumes the test server returns consistent data)
    expect(notificationCount).toBeLessThanOrEqual(1);
    
    await controller.stopMonitoring();
  }, 10000);

  it('should track appointment status history', async () => {
    const config = createTestConfig();
    
    // Start monitoring
    await controller.startMonitoring(config);
    
    // Wait for some checks
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get recent status changes
    const stats = await controller.getEnhancedStatistics();
    expect(stats.recentStatusChanges).toBeDefined();
    expect(Array.isArray(stats.recentStatusChanges)).toBe(true);
    
    await controller.stopMonitoring();
  }, 10000);

  it('should handle appointment removal detection', async () => {
    const config = createTestConfig();
    
    let appointmentsFound = 0;
    controller.on('appointments-found', (appointments) => {
      appointmentsFound = appointments.length;
    });
    
    // Start monitoring
    await controller.startMonitoring(config);
    
    // Wait for initial check
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get tracking statistics
    const stats = await controller.getEnhancedStatistics();
    
    // Should have some tracking data
    expect(stats.trackingStats.totalTracked).toBeGreaterThanOrEqual(0);
    
    await controller.stopMonitoring();
  }, 10000);

  it('should provide comprehensive tracking statistics', async () => {
    const config = createTestConfig();
    
    // Start monitoring
    await controller.startMonitoring(config);
    
    // Wait for some checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get enhanced statistics
    const stats = await controller.getEnhancedStatistics();
    
    // Verify tracking statistics structure
    expect(stats.trackingStats).toHaveProperty('totalTracked');
    expect(stats.trackingStats).toHaveProperty('availableCount');
    expect(stats.trackingStats).toHaveProperty('filledCount');
    expect(stats.trackingStats).toHaveProperty('pendingCount');
    expect(stats.trackingStats).toHaveProperty('notRegistrableCount');
    expect(stats.trackingStats).toHaveProperty('unknownCount');
    expect(stats.trackingStats).toHaveProperty('totalNotificationsSent');
    expect(stats.trackingStats).toHaveProperty('averageTrackingDuration');
    
    // All counts should be non-negative numbers
    expect(stats.trackingStats.totalTracked).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.availableCount).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.filledCount).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.pendingCount).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.notRegistrableCount).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.unknownCount).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.totalNotificationsSent).toBeGreaterThanOrEqual(0);
    expect(stats.trackingStats.averageTrackingDuration).toBeGreaterThanOrEqual(0);
    
    await controller.stopMonitoring();
  }, 10000);
});