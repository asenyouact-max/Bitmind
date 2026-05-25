const { spawn } = require('child_process');
const path = require('path');

/**
 * Master Test Runner
 * 
 * Runs all WebSocket tests sequentially with proper error handling
 * and clear status reporting.
 */

class TestRunner {
  constructor() {
    this.tests = [
      { name: 'reconnect', script: 'reconnect-test.js', args: ['--short'] },
      { name: 'sync', script: 'sync-test.js', args: ['--short'] },
      { name: 'cleanup', script: 'cleanup-test.js', args: ['--short'] },
      { name: 'longrun', script: 'longrun-test.js', args: ['--short'] },
      { name: 'chaos', script: 'chaos-test.js', args: ['--short'] }
    ];
    
    this.results = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log(`\n=== BITMIND WEBSOCKET TEST SUITE ===`);
    console.log(`Starting sequential test execution...`);
    console.log(`Tests to run: ${this.tests.length}`);
    console.log(`Started at: ${new Date().toISOString()}\n`);

    for (const test of this.tests) {
      const success = await this.runTest(test);
      
      if (!success) {
        console.log(`\n=== TEST SUITE ABORTED ===`);
        console.log(`Test '${test.name}' failed. Stopping execution.`);
        this.printSummary();
        process.exit(1);
      }
    }

    console.log(`\n=== ALL TESTS COMPLETED SUCCESSFULLY ===`);
    this.printSummary();
  }

  async runTest(test) {
    return new Promise((resolve) => {
      console.log(`=== RUNNING: ${test.name.toUpperCase()} ===`);
      console.log(`Script: ${test.script}`);
      console.log(`Args: ${test.args.join(' ')}`);
      console.log(`Started: ${new Date().toISOString()}\n`);

      const testProcess = spawn('node', [test.script, ...test.args], {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env }
      });

      let testResult = {
        name: test.name,
        success: false,
        startTime: Date.now(),
        endTime: null,
        duration: null,
        error: null
      };

      testProcess.on('close', (code) => {
        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        testResult.success = code === 0;

        if (code === 0) {
          console.log(`\n=== COMPLETED: ${test.name.toUpperCase()} ===`);
          console.log(`Duration: ${(testResult.duration / 1000).toFixed(1)}s`);
          console.log(`Status: SUCCESS\n`);
        } else {
          console.log(`\n=== FAILED: ${test.name.toUpperCase()} ===`);
          console.log(`Exit code: ${code}`);
          console.log(`Duration: ${(testResult.duration / 1000).toFixed(1)}s`);
          console.log(`Status: FAILED\n`);
          testResult.error = `Exit code ${code}`;
        }

        this.results.push(testResult);
        resolve(testResult.success);
      });

      testProcess.on('error', (error) => {
        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        testResult.success = false;
        testResult.error = error.message;

        console.log(`\n=== ERROR: ${test.name.toUpperCase()} ===`);
        console.log(`Error: ${error.message}`);
        console.log(`Duration: ${(testResult.duration / 1000).toFixed(1)}s\n`);

        this.results.push(testResult);
        resolve(false);
      });
    });
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;

    console.log(`\n=== TEST EXECUTION SUMMARY ===`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`Tests passed: ${passedTests}/${this.results.length}`);
    console.log(`Tests failed: ${failedTests}/${this.results.length}`);
    console.log(`Success rate: ${((passedTests / this.results.length) * 100).toFixed(1)}%\n`);

    console.log(`--- Individual Test Results ---`);
    this.results.forEach(result => {
      const status = result.success ? 'PASS' : 'FAIL';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`${result.name.padEnd(12)} ${status.padEnd(4)} ${duration.padStart(6)}s`);
      if (result.error) {
        console.log(`             Error: ${result.error}`);
      }
    });

    if (failedTests === 0) {
      console.log(`\nSUCCESS: All tests passed! WebSocket system is validated.`);
      console.log(`Ready for production deployment with ESP32 devices.`);
    } else {
      console.log(`\nFAILURE: ${failedTests} test(s) failed. Review logs above.`);
      console.log(`Address issues before deploying to production.`);
    }
  }
}

// Run all tests if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = TestRunner;
