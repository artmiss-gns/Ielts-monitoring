#!/usr/bin/env node

/**
 * Comprehensive validation script for mixed appointment detection
 * This script tests the detection logic against both filled and available appointments
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class MixedDetectionValidator {
  constructor() {
    this.serverProcess = null;
    this.testResults = {
      serverStarted: false,
      dataAdded: false,
      detectionTested: false,
      validationPassed: false,
      errors: []
    };
  }

  async validateDetection() {
    console.log('=== MIXED APPOINTMENT DETECTION VALIDATION ===\n');
    
    try {
      // Step 1: Start the test server
      await this.startTestServer();
      
      // Step 2: Add mixed test data
      await this.addMixedTestData();
      
      // Step 3: Wait for server to be ready
      await this.waitForServer();
      
      // Step 4: Run detection test
      await this.runDetectionTest();
      
      // Step 5: Validate results
      await this.validateResults();
      
      console.log('\n=== VALIDATION COMPLETE ===');
      console.log(`Overall result: ${this.testResults.validationPassed ? 'PASS' : 'FAIL'}`);
      
      return this.testResults.validationPassed;
      
    } catch (error) {
      console.error('Validation failed:', error);
      this.testResults.errors.push(error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  async startTestServer() {
    console.log('1. Starting test simulation server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['server.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let serverOutput = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        
        if (output.includes('running on')) {
          console.log('   ✓ Server started successfully');
          this.testResults.serverStarted = true;
          resolve();
        }
      });
      
      this.serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
      
      this.serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        reject(error);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.testResults.serverStarted) {
          reject(new Error('Server failed to start within 10 seconds'));
        }
      }, 10000);
    });
  }

  async addMixedTestData() {
    console.log('2. Adding mixed test appointment data...');
    
    return new Promise((resolve, reject) => {
      const addDataProcess = spawn('node', ['scripts/add-mixed-appointments.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      
      addDataProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      addDataProcess.stderr.on('data', (data) => {
        console.error('Add data error:', data.toString());
      });
      
      addDataProcess.on('close', (code) => {
        if (code === 0) {
          console.log('   ✓ Mixed test data added successfully');
          this.testResults.dataAdded = true;
          resolve();
        } else {
          reject(new Error(`Failed to add test data, exit code: ${code}`));
        }
      });
    });
  }

  async waitForServer() {
    console.log('3. Waiting for server to be ready...');
    
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          console.log('   ✓ Server is ready');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Server did not become ready within expected time');
  }

  async runDetectionTest() {
    console.log('4. Running detection logic test...');
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('node', ['scripts/test-detection-logic.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Show real-time output for important messages
        if (text.includes('PASS') || text.includes('FAIL') || text.includes('===')) {
          console.log('   ' + text.trim());
        }
      });
      
      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('   ✓ Detection test completed successfully');
          this.testResults.detectionTested = true;
          resolve({ output, success: true });
        } else {
          console.log('   ✗ Detection test failed');
          this.testResults.errors.push(`Detection test failed with code ${code}`);
          if (errorOutput) {
            this.testResults.errors.push(errorOutput);
          }
          resolve({ output, errorOutput, success: false });
        }
      });
    });
  }

  async validateResults() {
    console.log('5. Validating detection results...');
    
    try {
      // Check if test results file was created
      const logsDir = path.join(__dirname, '..', 'logs');
      const files = await fs.readdir(logsDir);
      const resultFiles = files.filter(file => file.startsWith('detection-test-results-'));
      
      if (resultFiles.length === 0) {
        throw new Error('No detection test results file found');
      }
      
      // Read the most recent results file
      const latestFile = resultFiles.sort().pop();
      const resultsPath = path.join(logsDir, latestFile);
      const resultsData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
      
      console.log('   Results file found:', latestFile);
      
      // Validate the results
      const validation = {
        hasFilledAppointments: resultsData.summary.filledDetected > 0,
        hasAvailableAppointments: resultsData.summary.availableDetected > 0,
        noDetectionErrors: resultsData.summary.detectionErrors === 0,
        totalAppointmentsCorrect: resultsData.summary.totalAppointments > 0
      };
      
      console.log('   Validation checks:');
      console.log(`     - Filled appointments detected: ${validation.hasFilledAppointments ? 'PASS' : 'FAIL'} (${resultsData.summary.filledDetected})`);
      console.log(`     - Available appointments detected: ${validation.hasAvailableAppointments ? 'PASS' : 'FAIL'} (${resultsData.summary.availableDetected})`);
      console.log(`     - No detection errors: ${validation.noDetectionErrors ? 'PASS' : 'FAIL'} (${resultsData.summary.detectionErrors} errors)`);
      console.log(`     - Total appointments found: ${validation.totalAppointmentsCorrect ? 'PASS' : 'FAIL'} (${resultsData.summary.totalAppointments})`);
      
      const allValidationsPassed = Object.values(validation).every(result => result === true);
      
      if (allValidationsPassed) {
        console.log('   ✓ All validation checks passed');
        this.testResults.validationPassed = true;
      } else {
        console.log('   ✗ Some validation checks failed');
        this.testResults.validationPassed = false;
      }
      
      // Store detailed results
      this.testResults.detectionSummary = resultsData.summary;
      
    } catch (error) {
      console.error('   ✗ Error validating results:', error.message);
      this.testResults.errors.push(`Validation error: ${error.message}`);
      this.testResults.validationPassed = false;
    }
  }

  async cleanup() {
    console.log('\n6. Cleaning up...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
      
      console.log('   ✓ Test server stopped');
    }
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      testType: 'Mixed Appointment Detection Validation',
      results: this.testResults,
      summary: {
        passed: this.testResults.validationPassed,
        serverStarted: this.testResults.serverStarted,
        dataAdded: this.testResults.dataAdded,
        detectionTested: this.testResults.detectionTested,
        errorCount: this.testResults.errors.length
      }
    };
    
    const reportPath = path.join(__dirname, '..', 'logs', `validation-report-${timestamp.replace(/[:.]/g, '-')}.json`);
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\nValidation report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Error saving validation report:', error);
    }
    
    return report;
  }
}

async function runValidation() {
  const validator = new MixedDetectionValidator();
  
  try {
    const success = await validator.validateDetection();
    await validator.generateReport();
    
    if (success) {
      console.log('\n🎉 Mixed appointment detection validation PASSED!');
      console.log('The detection logic correctly identifies both filled and available appointments.');
    } else {
      console.log('\n❌ Mixed appointment detection validation FAILED!');
      console.log('Issues found:');
      validator.testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('Validation process failed:', error);
    process.exit(1);
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Run validation if this script is executed directly
if (require.main === module) {
  console.log('Starting mixed appointment detection validation...\n');
  runValidation();
}

module.exports = MixedDetectionValidator;