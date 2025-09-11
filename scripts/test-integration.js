#!/usr/bin/env node

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');

const TEST_SERVER_PORT = 3001;
const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}`;

/**
 * Wait for server to be available
 */
async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await axios.get(`${url}/health`);
      console.log('✅ Test server is ready');
      return true;
    } catch (error) {
      console.log('⏳ Waiting for test server...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Test server at ${url} is not available after ${timeout}ms`);
}

/**
 * Start the test simulation server
 */
function startTestServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting test simulation server...');
    
    const serverProcess = spawn('node', ['test-simulation/server.js'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: TEST_SERVER_PORT }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[TEST-SERVER] ${output.trim()}`);
      
      if (output.includes('running on')) {
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[TEST-SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start test server:', error);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Test server exited with code ${code}`);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Test server failed to start within 10 seconds'));
    }, 10000);
  });
}

/**
 * Run integration tests
 */
function runIntegrationTests() {
  return new Promise((resolve, reject) => {
    console.log('🧪 Running integration tests...');
    
    const testProcess = spawn('npm', ['test', '--', '--testPathPattern=TestSimulationIntegration'], {
      stdio: 'inherit'
    });

    testProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Integration tests passed');
        resolve();
      } else {
        console.error('❌ Integration tests failed');
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      console.error('Failed to run tests:', error);
      reject(error);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  let serverProcess = null;
  
  try {
    // Start test server
    serverProcess = await startTestServer();
    
    // Wait for server to be ready
    await waitForServer(TEST_SERVER_URL);
    
    // Run integration tests
    await runIntegrationTests();
    
    console.log('🎉 All integration tests completed successfully');
    
  } catch (error) {
    console.error('❌ Integration test execution failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: kill test server
    if (serverProcess) {
      console.log('🛑 Stopping test server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});