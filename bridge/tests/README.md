# Bitmind WebSocket Testing Suite

Comprehensive testing suite for Bitmind mining system WebSocket reliability.

## Installation

```bash
cd tests
npm install
```

## Test Overview

### 1. Reconnect Torture Test
Tests WebSocket reconnection reliability under random disconnects.

```bash
npm run reconnect-test
# Or with custom client count:
node reconnect-test.js 10
```

**Validates:**
- Immediate job reception on reconnect
- Multiple reconnection cycles
- No client gets stuck without jobs

### 2. Multi-Client Sync Test
Ensures all clients receive identical job data simultaneously.

```bash
npm run sync-test
# Or with custom client count:
node sync-test.js 8
```

**Validates:**
- All clients receive same job_id
- No duplicate "new_job" events per client
- Synchronized job distribution

### 3. Dead Connection Cleanup Test
Tests backend cleanup of rapidly created/destroyed connections.

```bash
npm run cleanup-test
```

**Validates:**
- Backend doesn't retain dead connections
- No memory leaks from abandoned sockets
- Proper error handling for abrupt disconnects

### 4. Long-Run Stability Test
Extended duration test for memory leaks and connection stability.

```bash
npm run longrun-test
# Or with custom parameters:
node longrun-test.js 6 15  # 6 clients, 15 minutes
```

**Validates:**
- No crashes over extended periods
- Stable memory usage
- Consistent connection health

### 5. Network Simulation Client
Configurable client for remote testing and latency simulation.

```bash
# Connect to custom endpoint
node network-client.js ws://remote-host:3001/ws/mining REMOTE-CLIENT

# Test different network conditions
node network-client.js test-conditions

# With latency simulation
node network-client.js ws://localhost:3001/ws/mining LATENCY-TEST 500
```

**Features:**
- Configurable WebSocket endpoint
- Latency simulation
- Auto-reconnect with monitoring
- Network condition testing

## Usage Examples

### Quick Test Suite
Run all tests sequentially:

```bash
npm run reconnect-test && sleep 5 && \
npm run sync-test && sleep 5 && \
npm run cleanup-test && sleep 5 && \
npm run longrun-test 4 5
```

### Remote Server Testing
Test against remote Bitmind server:

```bash
node network-client.js ws://192.168.1.100:3001/ws/mining REMOTE-TEST
```

### Stress Testing
High-intensity reconnect testing:

```bash
node reconnect-test.js 15  # 15 clients
```

## Test Results Interpretation

### PASS/FAIL Indicators
- **PASS**: Test completed successfully
- **WARN**: Minor issues detected but acceptable
- **FAIL**: Critical problems found

### Key Metrics
- **Connection Success Rate**: % of successful connections
- **Reconnect Success Rate**: % of successful reconnections
- **Job Distribution**: Consistency of job data across clients
- **Memory Growth**: MB per minute of memory usage
- **Error Rate**: Errors per minute of operation

### Validation Criteria
- All clients receive at least one job
- No duplicate job receptions per client
- Reconnect success rate >= 80%
- Memory growth < 50MB for long tests
- Error rate < 1 per minute

## Troubleshooting

### Common Issues

**Connection Refused**
- Ensure Bitmind backend is running on port 3001
- Check firewall settings
- Verify WebSocket endpoint is accessible

**High Error Rate**
- Check backend logs for WebSocket errors
- Verify backend WebSocket stability
- Check network connectivity

**Memory Leaks**
- Monitor backend memory usage during tests
- Check for abandoned WebSocket connections
- Verify proper cleanup in backend code

### Debug Mode
Enable detailed logging:

```bash
DEBUG=* node reconnect-test.js
```

## Integration with ESP32

Use the network client to simulate ESP32 behavior:

```bash
# Simulate ESP32 with 500ms latency
node network-client.js ws://192.168.1.100:3001/ws/mining ESP32-SIM 500
```

This helps validate:
- Remote connectivity
- Latency handling
- Reconnection behavior
- Real-world device simulation

## Test Configuration

### Environment Variables
```bash
export BITMIND_WS_ENDPOINT=ws://localhost:3001/ws/mining
export BITMIND_TEST_DURATION=60000  # 60 seconds
export BITMIND_CLIENT_COUNT=8
```

### Custom Test Parameters
Most tests accept command-line arguments:

```bash
# Format: node test.js [clients] [duration] [options]
node longrun-test.js 10 20  # 10 clients, 20 minutes
```

## Production Readiness

Before deploying to production with ESP32 devices:

1. Run full test suite
2. Validate all PASS results
3. Test with network simulation
4. Verify remote connectivity
5. Monitor memory usage trends

The testing suite provides confidence that the WebSocket layer can handle real-world mining device connections reliably.
