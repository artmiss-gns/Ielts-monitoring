import { DataInspectionService } from '../../services/DataInspectionService';
import { TestDataFactory } from './TestDataFactory';
import { InspectionData } from '../../models/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock external dependencies
jest.mock('puppeteer');
jest.mock('node-notifier');

describe('Enhanced Monitoring System Integration Tests', () => {
  let dataInspectionService: DataInspectionService;
  let testDataDir: string;

  beforeAll(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, '../../../test-data-cli');
    await fs.ensureDir(testDataDir);
  });

  afterAll(async () => {
    // Clean up test data
    await fs.remove(testDataDir);
  });

  beforeEach(async () => {
    // Create fresh instances
    dataInspectionService = new DataInspectionService({
      dataDirectory: path.join(testDataDir, 'inspection'),
      maxInspectionRecords: 50 // Increased for performance testing
    });
    
    // Clean test data directory
    await fs.emptyDir(testDataDir);
  });

  describe('Inspection Data Export Integration', () => {
    test('should export inspection data in different formats', async () => {
      // Create multiple inspection records
      for (let i = 0; i < 3; i++) {
        const inspectionData: InspectionData = {
          url: `https://export-test-${i}.example.com`,
          pageTitle: `Export Test Page ${i}`,
          detectedElements: [`element-${i}`, `component-${i}`],
          parsingNotes: `Export test record ${i}`,
          rawAppointmentHtml: [`<div>test-html-${i}</div>`],
          checkResult: {
            type: 'available',
            appointmentCount: i + 1,
            availableCount: i + 1,
            filledCount: 0,
            timestamp: new Date(),
            url: `https://export-test-${i}.example.com`,
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
      expect(textExport).toContain('Export Test Page');

      // Test CSV export
      const csvExport = await dataInspectionService.exportInspectionData('csv', 2);
      expect(csvExport).toContain('ID,Timestamp,URL,PageTitle');
      expect(csvExport).toContain('export-test-');
    });

    test('should display inspection statistics correctly', async () => {
      // Create inspection records with different characteristics
      const inspectionRecords = [
        {
          url: 'https://stats-test-1.example.com',
          appointmentCount: 5,
          availableCount: 3,
          filledCount: 2
        },
        {
          url: 'https://stats-test-2.example.com',
          appointmentCount: 8,
          availableCount: 1,
          filledCount: 7
        }
      ];

      for (const record of inspectionRecords) {
        const inspectionData: InspectionData = {
          url: record.url,
          pageTitle: 'Stats Test Page',
          detectedElements: ['stats-element'],
          parsingNotes: 'Statistics test record',
          rawAppointmentHtml: ['<div>stats-html</div>'],
          checkResult: {
            type: 'available',
            appointmentCount: record.appointmentCount,
            availableCount: record.availableCount,
            filledCount: record.filledCount,
            timestamp: new Date(),
            url: record.url,
            appointments: TestDataFactory.createAppointments(record.appointmentCount)
          }
        };
        await dataInspectionService.saveInspectionData(inspectionData);
      }

      // Test statistics calculation
      const stats = await dataInspectionService.getInspectionStats();
      expect(stats.totalRecords).toBe(2);
      expect(stats.averageAppointmentsPerCheck).toBe(6.5); // (5 + 8) / 2
      expect(stats.availabilityRate).toBe(30.77); // (3 + 1) / (5 + 8) * 100
    });
  });

  describe('Enhanced Logging System Integration', () => {
    test('should capture detailed parsing information', async () => {
      // Create inspection data with comprehensive logging details
      const detailedInspectionData: InspectionData = {
        url: 'https://logging-test.example.com',
        pageTitle: 'Enhanced Logging Test Page',
        detectedElements: [
          'appointment-table-container',
          'availability-status-indicators', 
          'registration-button-elements',
          'date-time-selectors',
          'location-information-blocks'
        ],
        parsingNotes: 'Enhanced logging test: Successfully identified 5 key page elements. ' +
                     'Appointment table structure detected with proper status indicators. ' +
                     'Registration buttons found for available slots. ' +
                     'Date/time parsing completed successfully.',
        rawAppointmentHtml: [
          '<tr class="appointment-row available"><td class="date">2025-02-15</td><td class="time">09:00-12:00</td><td class="status">Available</td></tr>',
          '<tr class="appointment-row filled"><td class="date">2025-02-20</td><td class="time">14:00-17:00</td><td class="status">Filled</td></tr>',
          '<div class="appointment-card available"><span class="date">2025-02-25</span><span class="status">Open for Registration</span></div>'
        ],
        checkResult: {
          type: 'available',
          appointmentCount: 3,
          availableCount: 2,
          filledCount: 1,
          timestamp: new Date(),
          url: 'https://logging-test.example.com',
          appointments: TestDataFactory.createAppointments(3)
        }
      };

      const inspectionId = await dataInspectionService.saveInspectionData(detailedInspectionData);
      expect(inspectionId).toBeDefined();

      // Verify detailed logging information is preserved
      const retrievedData = await dataInspectionService.getInspectionDataById(inspectionId);
      expect(retrievedData).toBeDefined();
      expect(retrievedData!.data.detectedElements).toHaveLength(5);
      expect(retrievedData!.data.parsingNotes).toContain('Enhanced logging test');
      expect(retrievedData!.data.rawAppointmentHtml).toHaveLength(3);
      expect(retrievedData!.data.rawAppointmentHtml[0]).toContain('appointment-row available');
    });

    test('should format enhanced logging output correctly', async () => {
      const inspectionData: InspectionData = {
        url: 'https://format-test.example.com',
        pageTitle: 'Format Test Page',
        detectedElements: ['element1', 'element2'],
        parsingNotes: 'Format test with special characters: "quotes", <tags>, & symbols',
        rawAppointmentHtml: ['<div>HTML with "quotes" & symbols</div>'],
        checkResult: {
          type: 'available',
          appointmentCount: 1,
          availableCount: 1,
          filledCount: 0,
          timestamp: new Date(),
          url: 'https://format-test.example.com',
          appointments: TestDataFactory.createAppointments(1)
        }
      };

      const inspectionId = await dataInspectionService.saveInspectionData(inspectionData);
      const record = await dataInspectionService.getInspectionDataById(inspectionId);

      // Test formatting methods
      const summary = dataInspectionService.formatInspectionSummary(record!);
      const detailedOutput = await dataInspectionService.createDetailedInspectionOutput(record!);

      // Verify formatting handles special characters correctly
      expect(summary).toContain('Format test with special characters');
      expect(summary).toContain('"quotes"');
      expect(detailedOutput).toContain('DETAILED INSPECTION REPORT');
      expect(detailedOutput).toContain('HTML with "quotes" & symbols');
    });
  });

  describe('Enhanced Performance Integration', () => {
    test('should handle large inspection data sets efficiently', async () => {
      const startTime = Date.now();
      
      // Create a large number of inspection records
      const recordCount = 20;
      const inspectionIds: string[] = [];

      for (let i = 0; i < recordCount; i++) {
        const inspectionData: InspectionData = {
          url: `https://perf-test-${i}.example.com`,
          pageTitle: `Performance Test Page ${i}`,
          detectedElements: Array.from({ length: 10 }, (_, j) => `element-${i}-${j}`),
          parsingNotes: `Performance test record ${i} with extensive parsing notes. `.repeat(5),
          rawAppointmentHtml: Array.from({ length: 5 }, (_, j) => 
            `<div class="appointment-${i}-${j}">Large HTML content for performance testing</div>`.repeat(3)
          ),
          checkResult: {
            type: 'available',
            appointmentCount: 10,
            availableCount: 5,
            filledCount: 5,
            timestamp: new Date(),
            url: `https://perf-test-${i}.example.com`,
            appointments: TestDataFactory.createAppointments(10)
          }
        };
        
        const id = await dataInspectionService.saveInspectionData(inspectionData);
        inspectionIds.push(id);
      }

      const creationTime = Date.now() - startTime;

      // Test retrieval performance
      const retrievalStartTime = Date.now();
      const allRecords = await dataInspectionService.getAllInspectionRecords();
      const retrievalTime = Date.now() - retrievalStartTime;

      // Test export performance
      const exportStartTime = Date.now();
      const jsonExport = await dataInspectionService.exportInspectionData('json');
      const exportTime = Date.now() - exportStartTime;

      // Performance assertions
      expect(creationTime).toBeLessThan(5000); // Should create 20 records in under 5 seconds
      expect(retrievalTime).toBeLessThan(1000); // Should retrieve all records in under 1 second
      expect(exportTime).toBeLessThan(2000); // Should export in under 2 seconds
      expect(allRecords.length).toBeGreaterThanOrEqual(recordCount);
      expect(JSON.parse(jsonExport)).toHaveLength(allRecords.length);

      console.log(`Performance test completed: ${recordCount} records created in ${creationTime}ms, retrieved in ${retrievalTime}ms, exported in ${exportTime}ms`);
    });

    test('should maintain memory efficiency with inspection data cleanup', async () => {
      // Create inspection service with small limits for testing
      const testInspectionService = new DataInspectionService({
        dataDirectory: path.join(testDataDir, 'cleanup-test'),
        maxInspectionRecords: 5,
        cleanupIntervalHours: 0 // Immediate cleanup
      });

      // Create more records than the limit
      for (let i = 0; i < 10; i++) {
        const inspectionData: InspectionData = {
          url: `https://cleanup-test-${i}.example.com`,
          pageTitle: `Cleanup Test ${i}`,
          detectedElements: [`element-${i}`],
          parsingNotes: `Cleanup test record ${i}`,
          rawAppointmentHtml: [`<div>cleanup-html-${i}</div>`],
          checkResult: {
            type: 'available',
            appointmentCount: 1,
            availableCount: 1,
            filledCount: 0,
            timestamp: new Date(),
            url: `https://cleanup-test-${i}.example.com`,
            appointments: TestDataFactory.createAppointments(1)
          }
        };
        await testInspectionService.saveInspectionData(inspectionData);
      }

      // Trigger cleanup
      const removedCount = await testInspectionService.cleanupOldInspectionData();
      
      // Verify cleanup worked
      const remainingRecords = await testInspectionService.getAllInspectionRecords();
      expect(remainingRecords.length).toBeLessThanOrEqual(5);
      expect(removedCount).toBeGreaterThanOrEqual(0);

      console.log(`Cleanup test: ${removedCount} records removed, ${remainingRecords.length} remaining`);
    });
  });

  describe('Notification Filtering Integration', () => {
    test('should validate notification filtering logic', async () => {
      // Create mixed appointment data
      const availableAppointments = TestDataFactory.createAppointments(2, { status: 'available' });
      const filledAppointments = TestDataFactory.createAppointments(3, { status: 'filled' });
      
      // Test filtering logic
      const allAppointments = [...availableAppointments, ...filledAppointments];
      const availableOnly = allAppointments.filter(apt => apt.status === 'available');
      
      expect(availableOnly).toHaveLength(2);
      expect(availableOnly.every(apt => apt.status === 'available')).toBe(true);
      
      // Create inspection data to verify filtering is captured
      const inspectionData: InspectionData = {
        url: 'https://filtering-test.example.com',
        pageTitle: 'Filtering Test Page',
        detectedElements: ['filter-controls', 'appointment-list'],
        parsingNotes: `Filtering test: Found ${allAppointments.length} total appointments, ${availableOnly.length} available for notification`,
        rawAppointmentHtml: allAppointments.map(apt => 
          `<div class="appointment ${apt.status}">${apt.date} - ${apt.status}</div>`
        ),
        checkResult: {
          type: 'available',
          appointmentCount: allAppointments.length,
          availableCount: availableOnly.length,
          filledCount: filledAppointments.length,
          timestamp: new Date(),
          url: 'https://filtering-test.example.com',
          appointments: allAppointments
        }
      };

      const inspectionId = await dataInspectionService.saveInspectionData(inspectionData);
      const record = await dataInspectionService.getInspectionDataById(inspectionId);
      
      expect(record).toBeDefined();
      expect(record!.data.checkResult.availableCount).toBe(2);
      expect(record!.data.checkResult.filledCount).toBe(3);
    });
  });
});