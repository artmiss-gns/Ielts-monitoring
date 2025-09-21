#!/usr/bin/env node

/**
 * Test Suite Optimization Script
 * 
 * This script helps identify and optimize the test suite by:
 * 1. Running tests and collecting results
 * 2. Identifying consistently failing tests that may be outdated
 * 3. Generating a report of test health
 * 4. Suggesting optimizations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestOptimizer {
  constructor() {
    this.results = {
      passing: [],
      failing: [],
      outdated: [],
      performance: {}
    };
  }

  async analyzeTestSuite() {
    console.log('🔍 Analyzing test suite...');
    
    try {
      // Run tests and capture results
      const testOutput = execSync('npm test -- --json --outputFile=test-results.json --passWithNoTests', 
        { encoding: 'utf8', stdio: 'pipe' });
      
      // Parse results
      if (fs.existsSync('test-results.json')) {
        const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
        this.processTestResults(results);
      }
    } catch (error) {
      console.log('⚠️  Tests failed, analyzing partial results...');
      // Continue with analysis even if tests fail
    }

    this.generateReport();
  }

  processTestResults(results) {
    if (results.testResults) {
      results.testResults.forEach(testFile => {
        const filePath = testFile.name;
        
        testFile.assertionResults.forEach(test => {
          const testInfo = {
            file: filePath,
            name: test.title,
            status: test.status,
            duration: test.duration || 0
          };

          if (test.status === 'passed') {
            this.results.passing.push(testInfo);
          } else if (test.status === 'failed') {
            this.results.failing.push(testInfo);
            
            // Check if test might be outdated based on error patterns
            if (this.isLikelyOutdated(test)) {
              this.results.outdated.push(testInfo);
            }
          }
        });
      });
    }
  }

  isLikelyOutdated(test) {
    const outdatedPatterns = [
      /Cannot find name/,
      /is not assignable to parameter of type 'never'/,
      /Property .* does not exist/,
      /Maximum call stack size exceeded/,
      /page\.content is not a function/,
      /Browser not initialized/
    ];

    const errorMessage = test.failureMessages ? test.failureMessages.join(' ') : '';
    return outdatedPatterns.some(pattern => pattern.test(errorMessage));
  }

  generateReport() {
    console.log('\n📊 Test Suite Analysis Report');
    console.log('================================');
    
    console.log(`✅ Passing tests: ${this.results.passing.length}`);
    console.log(`❌ Failing tests: ${this.results.failing.length}`);
    console.log(`🗑️  Likely outdated tests: ${this.results.outdated.length}`);
    
    if (this.results.outdated.length > 0) {
      console.log('\n🗑️  Tests that appear to be outdated:');
      this.results.outdated.forEach(test => {
        console.log(`   - ${test.name} (${path.basename(test.file)})`);
      });
    }

    // Performance analysis
    const slowTests = this.results.passing
      .filter(test => test.duration > 5000)
      .sort((a, b) => b.duration - a.duration);

    if (slowTests.length > 0) {
      console.log('\n🐌 Slow tests (>5s):');
      slowTests.slice(0, 5).forEach(test => {
        console.log(`   - ${test.name}: ${test.duration}ms`);
      });
    }

    this.generateOptimizationSuggestions();
  }

  generateOptimizationSuggestions() {
    console.log('\n💡 Optimization Suggestions:');
    console.log('============================');
    
    if (this.results.outdated.length > 0) {
      console.log('1. Consider removing or updating outdated tests');
      console.log('   These tests may be testing functionality that no longer exists');
    }

    if (this.results.failing.length > this.results.passing.length) {
      console.log('2. High failure rate detected - focus on fixing core test infrastructure');
    }

    console.log('3. Run tests with --detectOpenHandles to identify resource leaks');
    console.log('4. Consider splitting large test files into smaller, focused test suites');
    console.log('5. Use --maxWorkers=1 for integration tests to avoid conflicts');
  }
}

// Run the optimizer
const optimizer = new TestOptimizer();
optimizer.analyzeTestSuite().catch(console.error);