#!/usr/bin/env node

/**
 * Script to test appointment detection logic against the simulation server
 * This validates that the detection algorithm correctly identifies filled vs available appointments
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_URL = 'http://localhost:3001/ielts/timetable';

class DetectionTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      totalAppointments: 0,
      filledDetected: 0,
      availableDetected: 0,
      unknownDetected: 0,
      detectionErrors: [],
      appointments: []
    };
  }

  async initialize() {
    console.log('Initializing browser for detection testing...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1200, height: 800 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  }

  async testDetectionLogic() {
    try {
      console.log(`Testing detection logic against: ${TEST_URL}`);
      
      // Navigate to the test page
      await this.page.goto(TEST_URL, { waitUntil: 'networkidle2' });
      
      // Wait for appointments to load
      await this.page.waitForSelector('.exam', { timeout: 10000 });
      
      // Wait a bit more for dynamic content
      await this.page.waitForTimeout(2000);
      
      // Extract appointment elements using the same selectors as the real detection logic
      const appointments = await this.page.evaluate(() => {
        const appointmentElements = document.querySelectorAll('a.exam__item.ielts');
        const results = [];
        
        appointmentElements.forEach((element, index) => {
          const appointment = {
            index: index,
            id: element.getAttribute('data-id') || `appointment-${index}`,
            rawHtml: element.outerHTML,
            
            // Check for filled indicators
            hasDisabledClass: element.classList.contains('disabled'),
            hasDisableButton: !!element.querySelector('.btn.disable'),
            hasFilledText: element.textContent.includes('تکمیل ظرفیت'),
            
            // Check for available indicators  
            hasActiveButton: !!element.querySelector('.btn.register'),
            hasAvailableText: element.textContent.includes('قابل ثبت نام'),
            hasRegistrationLink: element.href && element.href !== '#',
            
            // Extract appointment data
            date: element.querySelector('date span') ? 
                  element.querySelector('date span').textContent : 'Unknown',
            time: element.querySelector('em') ? 
                  element.querySelector('em').textContent : 'Unknown',
            location: element.querySelector('h5') ? 
                     element.querySelector('h5').textContent : 'Unknown',
            examType: element.querySelector('.exam_type') ? 
                     element.querySelector('.exam_type').textContent : 'Unknown',
            price: element.querySelector('h6') ? 
                   element.querySelector('h6').textContent : 'Unknown'
          };
          
          // Apply detection logic (same as the real algorithm)
          appointment.detectedStatus = this.determineStatus(appointment);
          appointment.filledIndicators = this.getFilledIndicators(appointment);
          appointment.availableIndicators = this.getAvailableIndicators(appointment);
          
          results.push(appointment);
        });
        
        return results;
      });
      
      this.results.totalAppointments = appointments.length;
      this.results.appointments = appointments;
      
      // Analyze results
      appointments.forEach(appointment => {
        switch (appointment.detectedStatus) {
          case 'filled':
            this.results.filledDetected++;
            break;
          case 'available':
            this.results.availableDetected++;
            break;
          case 'unknown':
            this.results.unknownDetected++;
            break;
          default:
            this.results.detectionErrors.push({
              appointmentId: appointment.id,
              error: `Unknown status: ${appointment.detectedStatus}`
            });
        }
      });
      
      return this.results;
      
    } catch (error) {
      console.error('Error during detection testing:', error);
      throw error;
    }
  }

  // Helper method to determine appointment status (mirrors the real detection logic)
  determineStatus(appointment) {
    // Phase 1: Check for filled indicators (highest priority)
    if (appointment.hasDisabledClass || 
        appointment.hasDisableButton || 
        appointment.hasFilledText) {
      return 'filled';
    }
    
    // Phase 2: Check for available indicators (only if not filled)
    if (appointment.hasActiveButton || 
        appointment.hasAvailableText || 
        appointment.hasRegistrationLink) {
      return 'available';
    }
    
    // Phase 3: Default to unknown if no clear indicators
    return 'unknown';
  }

  getFilledIndicators(appointment) {
    const indicators = [];
    if (appointment.hasDisabledClass) indicators.push('disabled-class');
    if (appointment.hasDisableButton) indicators.push('disable-button');
    if (appointment.hasFilledText) indicators.push('filled-text');
    return indicators;
  }

  getAvailableIndicators(appointment) {
    const indicators = [];
    if (appointment.hasActiveButton) indicators.push('active-button');
    if (appointment.hasAvailableText) indicators.push('available-text');
    if (appointment.hasRegistrationLink) indicators.push('registration-link');
    return indicators;
  }

  async validateResults() {
    console.log('\n=== DETECTION VALIDATION RESULTS ===');
    console.log(`Total appointments found: ${this.results.totalAppointments}`);
    console.log(`Filled appointments detected: ${this.results.filledDetected}`);
    console.log(`Available appointments detected: ${this.results.availableDetected}`);
    console.log(`Unknown status appointments: ${this.results.unknownDetected}`);
    
    if (this.results.detectionErrors.length > 0) {
      console.log(`\nDetection errors: ${this.results.detectionErrors.length}`);
      this.results.detectionErrors.forEach(error => {
        console.log(`- ${error.appointmentId}: ${error.error}`);
      });
    }
    
    console.log('\n=== DETAILED APPOINTMENT ANALYSIS ===');
    this.results.appointments.forEach((appointment, index) => {
      console.log(`\nAppointment ${index + 1}:`);
      console.log(`  Date: ${appointment.date}`);
      console.log(`  Time: ${appointment.time}`);
      console.log(`  Location: ${appointment.location}`);
      console.log(`  Detected Status: ${appointment.detectedStatus}`);
      console.log(`  Filled Indicators: ${appointment.filledIndicators.join(', ') || 'None'}`);
      console.log(`  Available Indicators: ${appointment.availableIndicators.join(', ') || 'None'}`);
    });
    
    // Validation checks
    const validationResults = {
      hasFilledAppointments: this.results.filledDetected > 0,
      hasAvailableAppointments: this.results.availableDetected > 0,
      noDetectionErrors: this.results.detectionErrors.length === 0,
      allAppointmentsClassified: this.results.totalAppointments === 
        (this.results.filledDetected + this.results.availableDetected + this.results.unknownDetected)
    };
    
    console.log('\n=== VALIDATION CHECKS ===');
    console.log(`✓ Has filled appointments: ${validationResults.hasFilledAppointments ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Has available appointments: ${validationResults.hasAvailableAppointments ? 'PASS' : 'FAIL'}`);
    console.log(`✓ No detection errors: ${validationResults.noDetectionErrors ? 'PASS' : 'FAIL'}`);
    console.log(`✓ All appointments classified: ${validationResults.allAppointmentsClassified ? 'PASS' : 'FAIL'}`);
    
    const allTestsPassed = Object.values(validationResults).every(result => result === true);
    console.log(`\n=== OVERALL RESULT: ${allTestsPassed ? 'PASS' : 'FAIL'} ===`);
    
    return allTestsPassed;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async saveResults() {
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `detection-test-results-${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'logs', filename);
    
    try {
      // Ensure logs directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      const reportData = {
        timestamp: new Date().toISOString(),
        testUrl: TEST_URL,
        summary: {
          totalAppointments: this.results.totalAppointments,
          filledDetected: this.results.filledDetected,
          availableDetected: this.results.availableDetected,
          unknownDetected: this.results.unknownDetected,
          detectionErrors: this.results.detectionErrors.length
        },
        appointments: this.results.appointments,
        detectionErrors: this.results.detectionErrors
      };
      
      await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
      console.log(`\nDetailed results saved to: ${filepath}`);
      
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }
}

async function runDetectionTest() {
  const tester = new DetectionTester();
  
  try {
    await tester.initialize();
    await tester.testDetectionLogic();
    const testsPassed = await tester.validateResults();
    await tester.saveResults();
    
    process.exit(testsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('Detection test failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  console.log('Starting appointment detection logic test...');
  console.log('Make sure the test simulation server is running on http://localhost:3001');
  runDetectionTest();
}

module.exports = DetectionTester;