#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Comprehensive test script for IELTS Test Simulation Server
 * Tests server functionality, API endpoints, HTML structure, and scripts
 */

class ServerTester {
  constructor() {
    this.serverProcess = null;
    this.baseUrl = 'http://localhost:3001';
    this.testResults = {
      serverStart: false,
      apiEndpoints: {},
      htmlStructure: false,
      scriptFunctionality: {},
      overall: false
    };
  }

  /**
   * Main test execution
   */
  async runTests() {
    console.log('🚀 Starting IELTS Test Simulation Server Tests\n');
    
    try {
      // Test 1: Server startup
      await this.testServerStartup();
      
      // Test 2: API endpoints
      await this.testApiEndpoints();
      
      // Test 3: HTML structure compatibility
      await this.testHtmlStructure();
      
      // Test 4: Script functionality
      await this.testScriptFunctionality();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test server starts correctly on port 3001
   */
  async testServerStartup() {
    console.log('📡 Testing server startup...');
    
    try {
      // Start the server
      this.serverProcess = spawn('node', ['server.js'], {
        cwd: path.join(__dirname),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for server to start
      await this.waitForServer(10000);
      
      // Test health endpoint
      const healthResponse = await this.makeRequest('/health');
      
      if (healthResponse.statusCode === 200 && healthResponse.data && healthResponse.data.status === 'OK') {
        this.testResults.serverStart = true;
        console.log('✅ Server started successfully on port 3001');
        console.log(`   Health check: ${healthResponse.data.status}`);
      } else {
        throw new Error(`Health check failed: ${JSON.stringify(healthResponse.data)}`);
      }
      
    } catch (error) {
      console.log('❌ Server startup failed:', error.message);
      this.testResults.serverStart = false;
    }
  }

  /**
   * Test all API endpoints return proper responses and status codes
   */
  async testApiEndpoints() {
    console.log('\n🔌 Testing API endpoints...');
    
    const endpoints = [
      {
        name: 'GET /api/appointments',
        method: 'GET',
        path: '/api/appointments',
        expectedStatus: 200,
        expectedType: 'array'
      },
      {
        name: 'POST /api/appointments',
        method: 'POST',
        path: '/api/appointments',
        expectedStatus: 201,
        body: {
          id: 'test-appointment-1',
          date: '2024-12-25',
          time: '09:00-12:00',
          location: 'Test Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'available'
        }
      },
      {
        name: 'PUT /api/appointments/:id',
        method: 'PUT',
        path: '/api/appointments/test-appointment-1',
        expectedStatus: 200,
        body: {
          status: 'full'
        }
      },
      {
        name: 'DELETE /api/appointments',
        method: 'DELETE',
        path: '/api/appointments',
        expectedStatus: 200
      }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint.path, endpoint.method, endpoint.body);
        
        if (response.statusCode === endpoint.expectedStatus) {
          this.testResults.apiEndpoints[endpoint.name] = true;
          console.log(`✅ ${endpoint.name}: Status ${response.statusCode}`);
          
          if (endpoint.expectedType === 'array' && Array.isArray(response.data)) {
            console.log(`   Response is array with ${response.data.length} items`);
          }
        } else {
          throw new Error(`Expected status ${endpoint.expectedStatus}, got ${response.statusCode}`);
        }
        
      } catch (error) {
        this.testResults.apiEndpoints[endpoint.name] = false;
        console.log(`❌ ${endpoint.name}: ${error.message}`);
      }
    }
  }

  /**
   * Test HTML structure matches WebScraperService selector expectations
   */
  async testHtmlStructure() {
    console.log('\n🌐 Testing HTML structure compatibility...');
    
    try {
      const htmlResponse = await this.makeRequest('/');
      const htmlContent = htmlResponse.data;
      
      // Check for selectors that WebScraperService expects
      const expectedSelectors = [
        '.appointment-card',
        '.timetable-item',
        '.exam-slot',
        '.appointment-item',
        '[data-appointment]',
        '.card',
        '#appointments-container',
        '.appointments-grid'
      ];
      
      const foundSelectors = [];
      const missingSelectors = [];
      
      for (const selector of expectedSelectors) {
        // Simple check for class/id presence in HTML
        const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const classOrId = selector.replace(/^[.#]/, '');
        
        if (htmlContent.includes(`class="${classOrId}"`) || 
            htmlContent.includes(`class='${classOrId}'`) ||
            htmlContent.includes(`id="${classOrId}"`) ||
            htmlContent.includes(`id='${classOrId}'`) ||
            htmlContent.includes(`data-appointment`) ||
            htmlContent.includes(classOrId)) {
          foundSelectors.push(selector);
        } else {
          missingSelectors.push(selector);
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
      
      if (foundSelectors.length > 0 && foundSemantic.length > 0) {
        this.testResults.htmlStructure = true;
        console.log('✅ HTML structure is compatible with WebScraperService');
        console.log(`   Found selectors: ${foundSelectors.join(', ')}`);
        console.log(`   Semantic elements: ${foundSemantic.join(', ')}`);
      } else {
        throw new Error('HTML structure missing expected selectors');
      }
      
    } catch (error) {
      this.testResults.htmlStructure = false;
      console.log('❌ HTML structure test failed:', error.message);
    }
  }

  /**
   * Test appointment trigger scripts modify data correctly
   */
  async testScriptFunctionality() {
    console.log('\n📜 Testing appointment trigger scripts...');
    
    // Test add-appointment script
    await this.testAddAppointmentScript();
    
    // Test clear-all script
    await this.testClearAllScript();
  }

  /**
   * Test add-appointment script
   */
  async testAddAppointmentScript() {
    try {
      console.log('   Testing add-appointment script...');
      
      // Get initial appointment count
      const initialResponse = await this.makeRequest('/api/appointments');
      const initialCount = initialResponse.data.length;
      
      // Run add-appointment script
      const addResult = await this.runScript('add-appointment.js', [
        '--id', 'script-test-1',
        '--date', '2024-12-30',
        '--time', '14:00',
        '--examType', 'IELTS',
        '--city', 'Tehran'
      ]);
      
      if (addResult.success) {
        // Check if appointment was added
        const afterResponse = await this.makeRequest('/api/appointments');
        const afterCount = afterResponse.data.length;
        
        if (afterCount === initialCount + 1) {
          // Verify the added appointment
          const addedAppointment = afterResponse.data.find(apt => apt.id === 'script-test-1');
          
          if (addedAppointment && 
              addedAppointment.date === '2024-12-30' &&
              addedAppointment.examType === 'IELTS' &&
              addedAppointment.city === 'Tehran') {
            
            this.testResults.scriptFunctionality['add-appointment'] = true;
            console.log('✅ add-appointment script works correctly');
            console.log(`   Added appointment: ${addedAppointment.id}`);
          } else {
            throw new Error('Added appointment data incorrect');
          }
        } else {
          throw new Error(`Expected ${initialCount + 1} appointments, got ${afterCount}`);
        }
      } else {
        throw new Error(`Script execution failed: ${addResult.error}`);
      }
      
    } catch (error) {
      this.testResults.scriptFunctionality['add-appointment'] = false;
      console.log('❌ add-appointment script test failed:', error.message);
    }
  }

  /**
   * Test clear-all script
   */
  async testClearAllScript() {
    try {
      console.log('   Testing clear-all script...');
      
      // Ensure there are appointments to clear
      const beforeResponse = await this.makeRequest('/api/appointments');
      const beforeCount = beforeResponse.data.length;
      
      if (beforeCount === 0) {
        // Add a test appointment first
        await this.makeRequest('/api/appointments', 'POST', {
          id: 'clear-test-1',
          date: '2024-12-31',
          time: '10:00-13:00',
          location: 'Test Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'available'
        });
      }
      
      // Run clear-all script with --force flag
      const clearResult = await this.runScript('clear-all.js', ['--force']);
      
      if (clearResult.success) {
        // Check if all appointments were cleared
        const afterResponse = await this.makeRequest('/api/appointments');
        const afterCount = afterResponse.data.length;
        
        if (afterCount === 0) {
          this.testResults.scriptFunctionality['clear-all'] = true;
          console.log('✅ clear-all script works correctly');
          console.log('   All appointments cleared successfully');
        } else {
          throw new Error(`Expected 0 appointments after clear, got ${afterCount}`);
        }
      } else {
        throw new Error(`Script execution failed: ${clearResult.error}`);
      }
      
    } catch (error) {
      this.testResults.scriptFunctionality['clear-all'] = false;
      console.log('❌ clear-all script test failed:', error.message);
    }
  }

  /**
   * Wait for server to be ready
   */
  async waitForServer(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await this.makeRequest('/health');
        return; // Server is ready
      } catch (error) {
        // Server not ready yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    throw new Error('Server failed to start within timeout');
  }

  /**
   * Make HTTP request to server
   */
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

  /**
   * Run a script and return result
   */
  async runScript(scriptName, args = []) {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, 'scripts', scriptName);
      const child = spawn('node', [scriptPath, ...args], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          error: code !== 0 ? stderr || `Script exited with code ${code}` : null
        });
      });
    });
  }

  /**
   * Generate test report
   */
  generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const serverStatus = this.testResults.serverStart ? '✅' : '❌';
    console.log(`Server Startup: ${serverStatus}`);
    
    console.log('\nAPI Endpoints:');
    for (const [endpoint, passed] of Object.entries(this.testResults.apiEndpoints)) {
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${endpoint}`);
    }
    
    const htmlStatus = this.testResults.htmlStructure ? '✅' : '❌';
    console.log(`\nHTML Structure: ${htmlStatus}`);
    
    console.log('\nScript Functionality:');
    for (const [script, passed] of Object.entries(this.testResults.scriptFunctionality)) {
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${script} script`);
    }
    
    // Calculate overall success
    const allTests = [
      this.testResults.serverStart,
      ...Object.values(this.testResults.apiEndpoints),
      this.testResults.htmlStructure,
      ...Object.values(this.testResults.scriptFunctionality)
    ];
    
    const passedTests = allTests.filter(Boolean).length;
    const totalTests = allTests.length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    this.testResults.overall = successRate === 100;
    
    console.log('\n========================');
    console.log(`Overall: ${passedTests}/${totalTests} tests passed (${successRate}%)`);
    
    if (this.testResults.overall) {
      console.log('🎉 All tests passed! Server is ready for integration.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues.');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.serverProcess) {
      console.log('\n🧹 Cleaning up server process...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
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
  const tester = new ServerTester();
  tester.runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = ServerTester;