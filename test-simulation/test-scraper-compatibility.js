#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

/**
 * Test script to verify HTML structure compatibility with WebScraperService
 * This simulates the actual scraping process to ensure selectors work correctly
 */

class ScraperCompatibilityTester {
  constructor() {
    this.serverProcess = null;
    this.baseUrl = 'http://localhost:3001';
  }

  async runTests() {
    console.log('🔍 Testing WebScraperService Compatibility\n');
    
    try {
      // Start server
      await this.startServer();
      
      // Add test appointments
      await this.setupTestData();
      
      // Test scraping compatibility
      await this.testScrapingCompatibility();
      
      // Test data extraction patterns
      await this.testDataExtraction();
      
      console.log('\n✅ All scraper compatibility tests passed!');
      
    } catch (error) {
      console.error('❌ Scraper compatibility test failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async startServer() {
    console.log('🚀 Starting test server...');
    
    this.serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready
    await this.waitForServer();
    console.log('✅ Server started successfully');
  }

  async setupTestData() {
    console.log('📝 Setting up test appointment data...');
    
    const testAppointments = [
      {
        id: 'scraper-test-1',
        date: '2024-12-25',
        time: '09:00-12:00',
        location: 'Isfahan Test Center - Room A',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available',
        price: 4500000,
        registrationUrl: 'https://example.com/register/scraper-test-1'
      },
      {
        id: 'scraper-test-2',
        date: '2024-12-26',
        time: '14:00-17:00',
        location: 'Tehran Test Center - Main Hall',
        examType: 'IELTS',
        city: 'Tehran',
        status: 'full',
        price: 5200000
      },
      {
        id: 'scraper-test-3',
        date: '2024-12-27',
        time: '10:30-13:30',
        location: 'Shiraz Test Center - Room B',
        examType: 'CDIELTS',
        city: 'Shiraz',
        status: 'pending',
        price: 4500000,
        registrationUrl: 'https://example.com/register/scraper-test-3'
      }
    ];

    for (const appointment of testAppointments) {
      await this.makeRequest('/api/appointments', 'POST', appointment);
    }
    
    console.log(`✅ Added ${testAppointments.length} test appointments`);
  }

  async testScrapingCompatibility() {
    console.log('🕷️  Testing scraping compatibility...');
    
    try {
      // Get the HTML content from the server
      const htmlResponse = await this.makeRequest('/');
      const htmlContent = htmlResponse.data;
      
      // Test HTML structure for WebScraperService compatibility
      const testResults = this.analyzeHtmlStructure(htmlContent);
      
      console.log(`✅ Found ${testResults.selectorsFound} compatible selectors`);
      console.log(`   Compatible selectors: ${testResults.foundSelectors.join(', ')}`);
      console.log(`✅ Found ${testResults.semanticElements} semantic elements`);
      console.log(`   Semantic elements: ${testResults.foundSemantic.join(', ')}`);
      
      if (testResults.selectorsFound === 0) {
        throw new Error('No compatible selectors found for WebScraperService');
      }
      
      // Test with actual appointment data
      const appointmentsResponse = await this.makeRequest('/api/appointments');
      const appointments = appointmentsResponse.data;
      
      console.log(`✅ Server has ${appointments.length} appointments for testing`);
      
      if (appointments.length > 0) {
        console.log('\n📋 Available appointment data:');
        appointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. ${apt.examType} - ${apt.city} - ${apt.status}`);
          console.log(`      Date: ${apt.date}, Time: ${apt.time}`);
          console.log(`      Location: ${apt.location}`);
        });
      }
      
      console.log('\n✅ WebScraperService compatibility verified!');
      
    } catch (error) {
      throw new Error(`Scraping compatibility test failed: ${error.message}`);
    }
  }

  analyzeHtmlStructure(htmlContent) {
    // Check for selectors that WebScraperService expects
    const expectedSelectors = [
      '.appointment-card',
      '.timetable-item',
      '.exam-slot',
      '.appointment-item',
      '[data-appointment]',
      '.card'
    ];
    
    const foundSelectors = [];
    
    for (const selector of expectedSelectors) {
      const classOrId = selector.replace(/^[.#\[]/, '').replace(/\]$/, '');
      
      if (htmlContent.includes(`class="${classOrId}"`) || 
          htmlContent.includes(`class='${classOrId}'`) ||
          htmlContent.includes(`id="${classOrId}"`) ||
          htmlContent.includes(`id='${classOrId}'`) ||
          htmlContent.includes(`data-appointment`) ||
          htmlContent.includes(classOrId)) {
        foundSelectors.push(selector);
      }
    }
    
    // Check for semantic structure
    const semanticElements = [
      'appointments-container',
      'appointments-grid',
      'appointment',
      'exam',
      'timetable'
    ];
    
    const foundSemantic = semanticElements.filter(element => 
      htmlContent.includes(element)
    );
    
    return {
      selectorsFound: foundSelectors.length,
      semanticElements: foundSemantic.length,
      foundSelectors,
      foundSemantic
    };
  }

  async testDataExtraction() {
    console.log('📊 Testing data extraction patterns...');
    
    try {
      // Test appointment data structure
      const appointmentsResponse = await this.makeRequest('/api/appointments');
      const appointments = appointmentsResponse.data;
      
      if (appointments.length > 0) {
        const sampleAppointment = appointments[0];
        
        // Verify required fields for WebScraperService
        const requiredFields = ['id', 'date', 'time', 'location', 'examType', 'city', 'status'];
        const missingFields = requiredFields.filter(field => !sampleAppointment[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Test date format (should be YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(sampleAppointment.date)) {
          throw new Error(`Invalid date format: ${sampleAppointment.date}`);
        }
        
        // Test time format (should be HH:MM-HH:MM)
        const timeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
        if (!timeRegex.test(sampleAppointment.time)) {
          throw new Error(`Invalid time format: ${sampleAppointment.time}`);
        }
        
        // Test exam type
        if (!['IELTS', 'CDIELTS'].includes(sampleAppointment.examType)) {
          throw new Error(`Invalid exam type: ${sampleAppointment.examType}`);
        }
        
        // Test status
        if (!['available', 'full', 'pending'].includes(sampleAppointment.status)) {
          throw new Error(`Invalid status: ${sampleAppointment.status}`);
        }
        
        console.log('✅ Data extraction patterns verified');
        console.log(`   Sample: ${sampleAppointment.examType} on ${sampleAppointment.date} at ${sampleAppointment.time}`);
        console.log(`   Location: ${sampleAppointment.location}`);
        console.log(`   Status: ${sampleAppointment.status}`);
        
      } else {
        console.log('⚠️  No appointments available for data extraction testing');
      }
      
    } catch (error) {
      throw new Error(`Data extraction test failed: ${error.message}`);
    }
  }

  async waitForServer(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await this.makeRequest('/health');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    throw new Error('Server failed to start within timeout');
  }

  async makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(data) 
              : data;
            
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: parsedData
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  async cleanup() {
    if (this.serverProcess) {
      console.log('\n🧹 Cleaning up server process...');
      this.serverProcess.kill('SIGTERM');
      
      await new Promise(resolve => {
        this.serverProcess.on('close', resolve);
        setTimeout(() => {
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }
}

// Run tests if script is called directly
if (require.main === module) {
  const tester = new ScraperCompatibilityTester();
  tester.runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = ScraperCompatibilityTester;