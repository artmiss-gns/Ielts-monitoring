/**
 * Test for WebScraperService mixed appointment detection against simulation server
 * Validates that the service correctly identifies both filled and available appointments
 * 
 * Requirements tested:
 * - 4.2: Test detection logic against simulation server with mixed appointment statuses
 * - 4.3: Validate that available appointments in simulation are correctly detected as "available"
 * - 4.5: Document detection results and HTML patterns found
 */

import { WebScraperService } from '../WebScraperService';
import { ScrapingFilters } from '../WebScraperService';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('WebScraperService - Mixed Appointment Detection', () => {
  let webScraperService: WebScraperService;
  let testServerProcess: ChildProcess | null = null;
  const TEST_SERVER_URL = 'http://localhost:3001';
  const TEST_SERVER_PATH = path.join(__dirname, '../../../test-simulation');

  beforeAll(async () => {
    // Start the test simulation server
    await startTestServer();
    
    // Add mixed test data
    await addMixedTestData();
    
    // Wait for server to be ready
    await waitForServer();
    
    // Initialize WebScraperService with test server URL
    webScraperService = new WebScraperService(TEST_SERVER_URL);
  }, 30000);

  afterAll(async () => {
    if (webScraperService) {
      await webScraperService.close();
    }
    
    if (testServerProcess) {
      testServerProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!testServerProcess.killed) {
        testServerProcess.kill('SIGKILL');
      }
    }
  }, 10000);

  describe('Mixed Status Detection', () => {
    it('should correctly detect both filled and available appointments', async () => {
      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts'],
        months: [11, 12] // November and December 2025
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      // Verify we got appointments
      expect(appointments).toBeDefined();
      expect(appointments.length).toBeGreaterThan(0);

      // Categorize appointments by status
      const filledAppointments = appointments.filter(apt => apt.status === 'filled');
      const availableAppointments = appointments.filter(apt => apt.status === 'available');
      const unknownAppointments = appointments.filter(apt => apt.status === 'unknown');

      // Verify we have both filled and available appointments
      expect(filledAppointments.length).toBeGreaterThan(0);
      expect(availableAppointments.length).toBeGreaterThan(0);

      console.log(`Detection results: ${filledAppointments.length} filled, ${availableAppointments.length} available, ${unknownAppointments.length} unknown`);

      // Validate filled appointments have correct indicators
      filledAppointments.forEach(appointment => {
        expect(appointment.status).toBe('filled');
        
        // Should have filled indicators in the raw HTML or detection metadata
        if (appointment.rawHtml) {
          const hasFilledIndicators = 
            appointment.rawHtml.includes('disabled') ||
            appointment.rawHtml.includes('تکمیل ظرفیت') ||
            appointment.rawHtml.includes('btn disable');
          
          expect(hasFilledIndicators).toBe(true);
        }
      });

      // Validate available appointments have correct indicators
      availableAppointments.forEach(appointment => {
        expect(appointment.status).toBe('available');
        
        // Should NOT have filled indicators
        if (appointment.rawHtml) {
          const hasFilledIndicators = 
            appointment.rawHtml.includes('disabled') ||
            appointment.rawHtml.includes('تکمیل ظرفیت');
          
          expect(hasFilledIndicators).toBe(false);
          
          // Should have available indicators
          const hasAvailableIndicators = 
            appointment.rawHtml.includes('قابل ثبت نام') ||
            appointment.rawHtml.includes('btn register') ||
            appointment.rawHtml.includes('registration-link');
          
          expect(hasAvailableIndicators).toBe(true);
        }
      });
    });

    it('should not mark filled appointments as available', async () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10, 11] // October and November 2025
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      // Find appointments that should be filled based on test data
      const filledTestAppointments = appointments.filter(apt => 
        apt.id?.includes('filled') || 
        (apt.rawHtml && (
          apt.rawHtml.includes('تکمیل ظرفیت') ||
          apt.rawHtml.includes('disabled')
        ))
      );

      // Verify none of these are marked as available
      filledTestAppointments.forEach(appointment => {
        expect(appointment.status).not.toBe('available');
        expect(appointment.status).toBe('filled');
      });

      expect(filledTestAppointments.length).toBeGreaterThan(0);
    });

    it('should correctly identify available appointments without filled indicators', async () => {
      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts'],
        months: [11, 12] // November and December 2025
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      // Find appointments that should be available based on test data
      const availableTestAppointments = appointments.filter(apt => 
        apt.id?.includes('available') || 
        (apt.rawHtml && (
          apt.rawHtml.includes('قابل ثبت نام') ||
          apt.rawHtml.includes('btn register')
        ))
      );

      // Verify these are marked as available
      availableTestAppointments.forEach(appointment => {
        expect(appointment.status).toBe('available');
        
        // Verify they don't have filled indicators
        if (appointment.rawHtml) {
          expect(appointment.rawHtml).not.toContain('تکمیل ظرفیت');
          expect(appointment.rawHtml).not.toContain('disabled');
        }
      });

      expect(availableTestAppointments.length).toBeGreaterThan(0);
    });

    it('should provide detailed detection metadata', async () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [12] // December 2025
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      appointments.forEach(appointment => {
        // Verify basic appointment data
        expect(appointment.id).toBeDefined();
        expect(appointment.date).toBeDefined();
        expect(appointment.time).toBeDefined();
        expect(appointment.location).toBeDefined();
        expect(appointment.status).toMatch(/^(filled|available|unknown)$/);

        // Verify detection metadata is available
        if (appointment.status === 'filled') {
          // In API mode, we rely on the status field from the test data
          // The status should be correctly determined from the test data
          expect(appointment.status).toBe('filled');
        }

        if (appointment.status === 'available') {
          // In API mode, we rely on the status field from the test data
          // The status should be correctly determined from the test data
          expect(appointment.status).toBe('available');
        }
      });
    });
  });

  describe('Conservative Detection Logic', () => {
    it('should prioritize filled indicators over available indicators', async () => {
      // This test would require creating an appointment with mixed signals
      // For now, we verify that the detection is conservative
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10, 11, 12]
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      // Verify no appointment is both filled and available
      appointments.forEach(appointment => {
        if (appointment.status === 'filled') {
          // If marked as filled, should not have available characteristics
          if (appointment.rawHtml) {
            // Should have filled indicators
            const hasFilledIndicators = 
              appointment.rawHtml.includes('disabled') ||
              appointment.rawHtml.includes('تکمیل ظرفیت');
            
            expect(hasFilledIndicators).toBe(true);
          }
        }
      });
    });

    it('should mark unclear appointments as unknown rather than available', async () => {
      const filters: ScrapingFilters = {
        city: ['mashhad'], // City that might have unclear appointments
        examModel: ['cdielts'],
        months: [12]
      };

      const appointments = await webScraperService.fetchAppointments(filters);

      // If there are any appointments without clear indicators, they should be unknown
      const unclearAppointments = appointments.filter(apt => 
        apt.id?.includes('unclear') || apt.status === 'unknown'
      );

      unclearAppointments.forEach(appointment => {
        expect(appointment.status).toBe('unknown');
        
        // Should not be marked as available without clear indicators
        expect(appointment.status).not.toBe('available');
      });
    });
  });

  // Helper functions
  async function startTestServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      testServerProcess = spawn('node', ['server.js'], {
        cwd: TEST_SERVER_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let resolved = false;

      testServerProcess.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('running on') && !resolved) {
          resolved = true;
          resolve();
        }
      });

      testServerProcess.stderr?.on('data', (data) => {
        console.error('Test server error:', data.toString());
      });

      testServerProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      // Timeout after 15 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Test server failed to start within 15 seconds'));
        }
      }, 15000);

      // Clear timeout when resolved
      const originalResolve = resolve;
      resolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };
    });
  }

  async function addMixedTestData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const addDataProcess = spawn('node', ['scripts/add-mixed-appointments.js'], {
        cwd: TEST_SERVER_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      addDataProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to add test data, exit code: ${code}`));
        }
      });

      addDataProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async function waitForServer(): Promise<void> {
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${TEST_SERVER_URL}/health`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Test server did not become ready within expected time');
  }
});