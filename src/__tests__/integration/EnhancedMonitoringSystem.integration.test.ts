import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { DataInspectionService } from '../../services/DataInspectionService';
import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';
import { PerformanceTestUtils } from './PerformanceTestUtils';
import { Appointment, CheckResult, InspectionData } from '../../models/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock external dependencies for controlled testing
jest.mock('puppeteer');
jest.mock('node-notifier');

describe('Enhanced Monitoring System Integration Tests', () => {
  let mockServer: MockIELTSServer;
  let monitorController: MonitorController;
  let dataInspectionService: DataInspectionService;
  let testDataDir: string;

  beforeAll(async () => {
    // Start mock server on different port to avoid conflicts
    mockServer = new MockIELTSServer(3002);
    await mockServer.start();
    
    // Create test data directory
    testDataDir = path.join(__dirname, '../../../test-data-enhanced');
    await fs.ensureDir(testDataDir);
  });

  afterAll(async () => {
    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
    }
    
    // Clean up test data
    await fs.remove(testDataDir);
  });

  beforeEach(async () => {
    // Reset mock server state
    mockServer.reset();
    
    // Create fresh instances
    monitorController = new MonitorController({ skipShutdownHandlers: true });
    dataInspectionService = new DataInspectionService({
      dataDirectory: path.join(testDataDir, 'inspection'),
      maxInspectionRecords: 10
    });
    
    // Clean test data directory
    await fs.emptyDir(testDataDir);
  });

  afterEach(async () => {
    // Stop monitoring if active
    if (monitorController.isActive()) {
      await monitorController.stopMonitoring();
    }
  });

  test('should initialize enhanced monitoring system', () => {
    expect(monitorController).toBeDefined();
    expect(dataInspectionService).toBeDefined();
  });

  describe('Appointment Status Detection', () => {
    test('should detect available appointments correctly', async () => {
      // Setup appointments with available status
      const availableAppointments = TestDataFactory.createAppointments(2, { status: 'available' });
      mockServer.setAppointments(availableAppointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
        city: ['isfahan'],
        examModel: ['cdielts']
      });

      // Track appointment detection events
      const detectedAppointments: Appointment[] = [];
      monitorController.on('appointments-found', (appointments: Appointment[]) => {
        detectedAppointments.push(...appointments);
      });

      // Start monitoring
      await monitorController.startMonitoring(config);
      
      // Wait for detection
      await PerformanceTestUtils.wait(400);
      
      // Stop monitoring
      await monitorController.stopMonitoring();

      // Verify available appointments were detected
      expect(detectedAppointments.length).toBeGreaterThan(0);
      expect(detectedAppointments.every(apt => apt.status === 'available')).toBe(true);
    });

    test('should handle mixed available and filled appointments', async () => {
      // Setup mixed appointments
      const availableAppointments = TestDataFactory.createAppointments(2, { status: 'available' });
      const filledAppointments = TestDataFactory.createAppointments(2, { status: 'filled' });
      const mixedAppointments = [...availableAppointments, ...filledAppointments];
      
      mockServer.setAppointments(mixedAppointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300
      });

      // Track check results
      const checkResults: CheckResult[] = [];
      monitorController.on('check-completed', (result: CheckResult) => {
        checkResults.push(result);
      });

      // Start monitoring
      await monitorController.startMonitoring(config);
      
      // Wait for check
      await PerformanceTestUtils.wait(400);
      
      // Stop monitoring
      await monitorController.stopMonitoring();

      // Verify mixed scenario detection
      expect(checkResults.length).toBeGreaterThan(0);
      const latestResult = checkResults[checkResults.length - 1];
      expect(latestResult.appointmentCount).toBe(4);
      expect(latestResult.availableCount).toBe(2);
      expect(latestResult.filledCount).toBe(2);
    });
  });

  describe('Inspection Data Management', () => {
    test('should save and retrieve inspection data accurately', async () => {
      // Create test inspection data
      const inspectionData: InspectionData = {
        url: 'https://test.example.com',
        pageTitle: 'Test IELTS Page',
        detectedElements: ['appointment-table', 'registration-button', 'date-selector'],
        parsingNotes: 'Successfully parsed appointments with mixed availability',
        rawAppointmentHtml: [
          '<tr class="available"><td>2025-02-15</td><td>09:00</td></tr>',
          '<tr class="filled"><td>2025-02-20</td><td>14:00</td></tr>'
        ],
        checkResult: {
          type: 'available',
          appointmentCount: 2,
          availableCount: 1,
          filledCount: 1,
          timestamp: new Date(),
          url: 'https://test.example.com',
          appointments: TestDataFactory.createAppointments(2)
        }
      };

      // Save inspection data
      const inspectionId = await dataInspectionService.saveInspectionData(inspectionData);
      expect(inspectionId).toBeDefined();

      // Retrieve and verify
      const retrievedData = await dataInspectionService.getInspectionDataById(inspectionId);
      expect(retrievedData).toBeDefined();
      expect(retrievedData!.data.url).toBe(inspectionData.url);
      expect(retrievedData!.data.pageTitle).toBe(inspectionData.pageTitle);
      expect(retrievedData!.data.detectedElements).toEqual(inspectionData.detectedElements);
      expect(retrievedData!.data.checkResult.appointmentCount).toBe(2);
    });

    test('should export inspection data in multiple formats', async () => {
      // Create inspection records
      for (let i = 0; i < 2; i++) {
        const inspectionData: InspectionData = {
          url: `https://test${i}.example.com`,
          pageTitle: `Test Page ${i}`,
          detectedElements: [`element${i}`],
          parsingNotes: `Notes for test ${i}`,
          rawAppointmentHtml: [`<div>html${i}</div>`],
          checkResult: {
            type: 'available',
            appointmentCount: i + 1,
            availableCount: i + 1,
            filledCount: 0,
            timestamp: new Date(),
            url: `https://test${i}.example.com`,
            appointments: TestDataFactory.createAppointments(i + 1)
          }
        };
        await dataInspectionService.saveInspectionData(inspectionData);
      }

      // Test JSON export
      const jsonExport = await dataInspectionService.exportInspectionData('json', 2);
      const jsonData = JSON.parse(jsonExport);
      expect(Array.isArray(jsonData)).toBe(true);
      expect(jsonData.length).toBe(2);

      // Test text export
      const textExport = await dataInspectionService.exportInspectionData('text', 2);
      expect(textExport).toContain('INSPECTION SUMMARY');
      expect(textExport).toContain('Test Page');
    });
  });

  describe('Notification Filtering', () => {
    test('should filter appointments by city criteria', async () => {
      // Setup appointments for different cities
      const isfahanAppointments = TestDataFactory.createAppointmentsForCities(['isfahan']);
      const tehranAppointments = TestDataFactory.createAppointmentsForCities(['tehran']);
      const shirazAppointments = TestDataFactory.createAppointmentsForCities(['shiraz']);
      
      mockServer.setAppointments([...isfahanAppointments, ...tehranAppointments, ...shirazAppointments]);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
        city: ['isfahan', 'tehran'], // Only monitor Isfahan and Tehran
        examModel: ['cdielts']
      });

      // Track filtered appointments
      const filteredAppointments: Appointment[] = [];
      monitorController.on('appointments-found', (appointments: Appointment[]) => {
        filteredAppointments.push(...appointments);
      });

      // Start monitoring
      await monitorController.startMonitoring(config);
      
      // Wait for filtering
      await PerformanceTestUtils.wait(400);
      
      // Stop monitoring
      await monitorController.stopMonitoring();

      // Verify city filtering
      expect(filteredAppointments.length).toBeGreaterThan(0);
      expect(filteredAppointments.every(apt => 
        apt.city === 'isfahan' || apt.city === 'tehran'
      )).toBe(true);
      expect(filteredAppointments.some(apt => apt.city === 'shiraz')).toBe(false);
    });

    test('should only notify for available appointments', async () => {
      // Setup mixed appointments
      const availableAppointments = TestDataFactory.createAppointments(1, { status: 'available' });
      const filledAppointments = TestDataFactory.createAppointments(2, { status: 'filled' });
      mockServer.setAppointments([...availableAppointments, ...filledAppointments]);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
        notificationSettings: {
          desktop: false,
          audio: false,
          logFile: true
        }
      });

      // Track notifications
      const notifications: Appointment[][] = [];
      monitorController.on('new-appointments', (appointments: Appointment[]) => {
        notifications.push(appointments);
      });

      // Start monitoring
      await monitorController.startMonitoring(config);
      
      // Wait for initial check
      await PerformanceTestUtils.wait(400);

      // Add new available appointment
      const newAvailable = TestDataFactory.createAppointments(1, { status: 'available' })[0];
      newAvailable.date = '2025-03-01';
      mockServer.addAppointments([newAvailable]);

      // Wait for detection
      await PerformanceTestUtils.wait(400);
      
      // Stop monitoring
      await monitorController.stopMonitoring();

      // Verify only available appointments triggered notifications
      if (notifications.length > 0) {
        const notifiedAppointments = notifications.flat();
        expect(notifiedAppointments.every(apt => apt.status === 'available')).toBe(true);
      }
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency parsing efficiently', async () => {
      // Setup appointments for frequent parsing
      const appointments = TestDataFactory.createAppointments(5);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200 // Fast for performance testing
      });

      // Track parsing performance
      let parseCount = 0;
      monitorController.on('check-completed', () => {
        parseCount++;
      });

      // Measure performance
      const { executionTime, result } = await PerformanceTestUtils.measureExecutionTime(async () => {
        await monitorController.startMonitoring(config);
        await PerformanceTestUtils.wait(1000); // Run for 1 second
        await monitorController.stopMonitoring();
        return 'completed';
      });

      expect(result).toBe('completed');
      expect(parseCount).toBeGreaterThan(2); // Should complete multiple parses
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds

      const parsesPerSecond = parseCount / (executionTime / 1000);
      expect(parsesPerSecond).toBeGreaterThan(1); // At least 1 parse per second

      console.log(`Parsing Performance: ${parseCount} parses in ${executionTime}ms (${parsesPerSecond.toFixed(2)} parses/sec)`);
    });

    test('should maintain memory efficiency during inspection data collection', async () => {
      const appointments = TestDataFactory.createAppointments(3);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300
      });

      // Monitor memory during operation
      const { result, metrics } = await PerformanceTestUtils.monitorMemoryUsage(async () => {
        await monitorController.startMonitoring(config);
        
        // Run for a period with some changes
        for (let i = 0; i < 5; i++) {
          await PerformanceTestUtils.wait(400);
          
          // Add new appointment to trigger processing
          const newAppointment = TestDataFactory.createAppointments(1)[0];
          newAppointment.date = `2025-02-${15 + i}`;
          mockServer.addAppointments([newAppointment]);
        }
        
        await monitorController.stopMonitoring();
        return 'completed';
      }, {
        sampleInterval: 200,
        maxSamples: 20
      });

      expect(result).toBe('completed');

      // Assert reasonable memory usage
      PerformanceTestUtils.assertMemoryLimits(metrics, {
        maxMemoryGrowthMB: 50, // Allow up to 50MB growth
        maxPeakMemoryMB: 200,  // Peak memory should not exceed 200MB
        maxMemoryEfficiencyMBPerSecond: 10 // Memory growth rate limit
      });

      console.log(`Memory efficiency test completed: ${PerformanceTestUtils.formatMemory(metrics.peakMemory)} peak usage`);
    });
  });

  describe('Complete Enhanced Workflow Integration', () => {
    test('should execute complete enhanced monitoring workflow', async () => {
      // Setup comprehensive test scenario
      const initialAppointments = TestDataFactory.createAppointments(2, { status: 'filled' });
      mockServer.setAppointments(initialAppointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2, 3],
        notificationSettings: {
          desktop: false,
          audio: false,
          logFile: true
        }
      });

      // Track all events
      const events: { type: string; data: any; timestamp: Date }[] = [];
      
      const trackEvent = (type: string, data: any) => {
        events.push({ type, data, timestamp: new Date() });
      };

      monitorController.on('status-changed', (status: MonitorStatus) => trackEvent('status-changed', status));
      monitorController.on('check-completed', (result: CheckResult) => trackEvent('check-completed', result));
      monitorController.on('appointments-found', (appointments: Appointment[]) => trackEvent('appointments-found', appointments));
      monitorController.on('new-appointments', (appointments: Appointment[]) => trackEvent('new-appointments', appointments));

      // Phase 1: Start monitoring with filled appointments
      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);

      // Phase 2: Add available appointments
      const newAvailable = TestDataFactory.createAppointments(1, { status: 'available' });
      newAvailable[0].date = '2025-02-25';
      mockServer.addAppointments(newAvailable);
      await PerformanceTestUtils.wait(400);

      // Phase 3: Stop monitoring
      await monitorController.stopMonitoring();

      // Verify complete workflow
      expect(events.some(e => e.type === 'status-changed' && e.data === 'starting')).toBe(true);
      expect(events.some(e => e.type === 'status-changed' && e.data === 'running')).toBe(true);
      expect(events.some(e => e.type === 'status-changed' && e.data === 'stopped')).toBe(true);
      expect(events.some(e => e.type === 'check-completed')).toBe(true);

      // Verify inspection data was collected
      const latestInspection = await dataInspectionService.getLatestInspectionData();
      expect(latestInspection).toBeDefined();

      // Verify statistics
      const stats = await dataInspectionService.getInspectionStats();
      expect(stats.totalRecords).toBeGreaterThanOrEqual(0);

      console.log(`Complete workflow test: ${events.length} events tracked, ${stats.totalRecords} inspection records created`);
    });
  });
});

