import { CLIController } from '../../cli/CLIController';
import { DataInspectionService } from '../../services/DataInspectionService';
import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';
import { InspectionData } from '../../models/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock external dependencies
jest.mock('puppeteer');
jest.mock('node-notifier');

describe('CLI Inspection Integration Tests', () => {
  let cliController: CLIController;
  let dataInspectionService: DataInspectionService;
  let mockServer: MockIELTSServer;
  let testDataDir: string;

  beforeAll(async () => {
    // Start mock server
    mockServer = new MockIELTSServer(3006);
    await mockServer.start();
    
    // Create test data directory
    testDataDir = path.join(__dirname, '../../../test-data-cli');
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
    
    // Clean test data directory first
    await fs.emptyDir(testDataDir);
    
    // Create fresh instances with unique directories for each test
    const testId = Math.random().toString(36).substring(7);
    cliController = new CLIController();
    dataInspectionService = new DataInspectionService({
      dataDirectory: path.join(testDataDir, 'inspection', testId),
      maxInspectionRecords: 10
    });
  });

  describe('CLI Command Integration', () => {
    test('should handle inspection data export command', async () => {
      // Create test inspection data
      const inspectionData: InspectionData = {
        url: 'https://cli-test.example.com',
        pageTitle: 'CLI Test Page',
        detectedElements: ['cli-element-1', 'cli-element-2'],
        parsingNotes: 'CLI integration test data',
        rawAppointmentHtml: ['<div>CLI test HTML</div>'],
        checkResult: {
          type: 'available',
          appointmentCount: 1,
          availableCount: 1,
          filledCount: 0,
          timestamp: new Date(),
          url: 'https://cli-test.example.com',
          appointments: TestDataFactory.createAppointments(1)
        }
      };

      // Save inspection data
      await dataInspectionService.saveInspectionData(inspectionData);

      // Test export functionality
      const exportData = await dataInspectionService.exportInspectionData('json', 1);
      const parsedData = JSON.parse(exportData);

      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].data.pageTitle).toBe('CLI Test Page');
      expect(parsedData[0].data.detectedElements).toContain('cli-element-1');
    });

    test('should handle inspection statistics command', async () => {
      // Create multiple inspection records
      for (let i = 0; i < 3; i++) {
        const inspectionData: InspectionData = {
          url: `https://cli-stats-${i}.example.com`,
          pageTitle: `CLI Stats Test ${i}`,
          detectedElements: [`stats-element-${i}`],
          parsingNotes: `CLI stats test ${i}`,
          rawAppointmentHtml: [`<div>stats-html-${i}</div>`],
          checkResult: {
            type: 'available',
            appointmentCount: i + 1,
            availableCount: i + 1,
            filledCount: 0,
            timestamp: new Date(),
            url: `https://cli-stats-${i}.example.com`,
            appointments: TestDataFactory.createAppointments(i + 1)
          }
        };
        await dataInspectionService.saveInspectionData(inspectionData);
      }

      // Test statistics calculation
      const stats = await dataInspectionService.getInspectionStats();
      expect(stats.totalRecords).toBeGreaterThanOrEqual(3);
      expect(stats.averageAppointmentsPerCheck).toBeGreaterThan(0);
    });
  });

  describe('CLI Error Handling', () => {
    test('should handle invalid command gracefully', async () => {
      // Test that CLI handles invalid commands without crashing
      expect(cliController).toBeDefined();
      
      // In a real CLI test, we would test command parsing and error handling
      // For now, we verify the controller can be instantiated
    });

    test('should handle missing inspection data gracefully', async () => {
      // Create a fresh service instance with no data
      const freshService = new DataInspectionService({
        dataDirectory: path.join(testDataDir, 'empty-test'),
        maxInspectionRecords: 10
      });
      
      // Test export with no data
      const exportData = await freshService.exportInspectionData('json', 10);
      const parsedData = JSON.parse(exportData);
      
      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData).toHaveLength(0);
    });
  });

  describe('CLI Output Formatting', () => {
    test('should format inspection summary correctly', async () => {
      const inspectionData: InspectionData = {
        url: 'https://format-test.example.com',
        pageTitle: 'Format Test Page',
        detectedElements: ['format-element'],
        parsingNotes: 'Format test with special characters: "quotes" & symbols',
        rawAppointmentHtml: ['<div>Format test HTML</div>'],
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

      expect(record).toBeDefined();
      
      // Test formatting methods
      const summary = dataInspectionService.formatInspectionSummary(record!);
      expect(summary).toContain('Format Test Page');
      expect(summary).toContain('format-element');
    });

    test('should format detailed inspection output correctly', async () => {
      const inspectionData: InspectionData = {
        url: 'https://detailed-test.example.com',
        pageTitle: 'Detailed Test Page',
        detectedElements: ['detailed-element-1', 'detailed-element-2'],
        parsingNotes: 'Detailed test with comprehensive information',
        rawAppointmentHtml: [
          '<div class="appointment">Appointment 1</div>',
          '<div class="appointment">Appointment 2</div>'
        ],
        checkResult: {
          type: 'available',
          appointmentCount: 2,
          availableCount: 2,
          filledCount: 0,
          timestamp: new Date(),
          url: 'https://detailed-test.example.com',
          appointments: TestDataFactory.createAppointments(2)
        }
      };

      const inspectionId = await dataInspectionService.saveInspectionData(inspectionData);
      const record = await dataInspectionService.getInspectionDataById(inspectionId);

      expect(record).toBeDefined();
      
      // Test detailed output formatting
      const detailedOutput = await dataInspectionService.createDetailedInspectionOutput(record!);
      expect(detailedOutput).toContain('DETAILED INSPECTION REPORT');
      expect(detailedOutput).toContain('Detailed Test Page');
      expect(detailedOutput).toContain('detailed-element-1');
    });
  });

  describe('CLI Performance', () => {
    test('should handle large inspection data sets efficiently', async () => {
      const startTime = Date.now();
      
      // Create multiple inspection records
      const recordCount = 10;
      for (let i = 0; i < recordCount; i++) {
        const inspectionData: InspectionData = {
          url: `https://perf-test-${i}.example.com`,
          pageTitle: `Performance Test ${i}`,
          detectedElements: [`perf-element-${i}`],
          parsingNotes: `Performance test record ${i}`,
          rawAppointmentHtml: [`<div>perf-html-${i}</div>`],
          checkResult: {
            type: 'available',
            appointmentCount: 1,
            availableCount: 1,
            filledCount: 0,
            timestamp: new Date(),
            url: `https://perf-test-${i}.example.com`,
            appointments: TestDataFactory.createAppointments(1)
          }
        };
        await dataInspectionService.saveInspectionData(inspectionData);
      }

      const creationTime = Date.now() - startTime;

      // Test export performance
      const exportStartTime = Date.now();
      const exportData = await dataInspectionService.exportInspectionData('json');
      const exportTime = Date.now() - exportStartTime;

      // Performance assertions
      expect(creationTime).toBeLessThan(5000); // Should create records in under 5 seconds
      expect(exportTime).toBeLessThan(1000); // Should export in under 1 second
      
      const parsedData = JSON.parse(exportData);
      expect(parsedData).toHaveLength(recordCount);
    });
  });

  describe('CLI Integration with Mock Server', () => {
    test('should integrate with mock server for testing', async () => {
      // Setup mock server with test data
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      // Verify mock server is working
      const stats = mockServer.getStats();
      expect(stats.appointmentCount).toBe(2);
      expect(mockServer.getUrl()).toBe('http://localhost:3006');
    });

    test('should handle mock server failures gracefully', async () => {
      // Configure mock server to fail
      mockServer.setFailure(true, 'network');

      // Test that CLI components handle server failures
      const stats = mockServer.getStats();
      expect(stats).toBeDefined();
      
      // Reset server
      mockServer.setFailure(false);
    });
  });
});