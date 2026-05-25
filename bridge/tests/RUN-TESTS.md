# Bitmind WebSocket Test Execution

## Quick Start

```bash
cd tests
npm install
node run-all-tests.js
```

## Individual Tests

```bash
# Run individual tests (short mode)
npm run reconnect
npm run sync
npm run cleanup
npm run longrun
npm run chaos

# Full duration tests
node reconnect-test.js 10
node chaos-test.js 20 30
```

## Expected Output

Each test will show:
- === RUNNING: TEST_NAME ===
- === COMPLETED: TEST_NAME ===
- Final PASS/FAIL summary

## Success Criteria

- All 5 tests must pass
- 100% success rate
- WebSocket system validated for production
