const crypto = require('crypto');
const { bitcoinWorkService } = require('./bitcoinWork');

/**
 * Verification tests for Bitcoin work construction
 */

console.log('=== Bitcoin Work Construction Verification Tests ===\n');

// Test 1: Coinbase construction
console.log('Test 1: Coinbase Construction');
const mockBlockTemplate = {
  height: 800000,
  coinbasevalue: 625000000,
  coinbaseaddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  transactions: []
};

const extranonce1 = '1234567890abcdef';
try {
  const coinbase = bitcoinWorkService.constructCoinbase(mockBlockTemplate, extranonce1, mockBlockTemplate.height);
  console.log('✓ Coinbase constructed successfully');
  console.log('  - Version:', coinbase.version);
  console.log('  - Inputs:', coinbase.inputs.length);
  console.log('  - Outputs:', coinbase.outputs.length);
  console.log('  - Locktime:', coinbase.locktime);
} catch (error) {
  console.log('✗ Coinbase construction failed:', error.message);
}

// Test 2: Transaction ID calculation
console.log('\nTest 2: Transaction ID Calculation');
try {
  const coinbase = bitcoinWorkService.constructCoinbase(mockBlockTemplate, extranonce1, mockBlockTemplate.height);
  const txid = bitcoinWorkService.calculateTxid(coinbase);
  console.log('✓ Txid calculated successfully');
  console.log('  - Txid:', txid);
  console.log('  - Length:', txid.length, 'characters');
  console.log('  - Valid hex:', /^[0-9a-f]{64}$/.test(txid) ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Txid calculation failed:', error.message);
}

// Test 3: Merkle root calculation with single transaction
console.log('\nTest 3: Merkle Root Calculation (Single Transaction)');
try {
  const coinbase = bitcoinWorkService.constructCoinbase(mockBlockTemplate, extranonce1, mockBlockTemplate.height);
  const coinbaseTxid = bitcoinWorkService.calculateTxid(coinbase);
  const merkleroot = bitcoinWorkService.calculateMerkleRoot([coinbaseTxid]);
  console.log('✓ Merkle root calculated successfully');
  console.log('  - Merkle root:', merkleroot);
  console.log('  - Length:', merkleroot.length, 'characters');
  console.log('  - Valid hex:', /^[0-9a-f]{64}$/.test(merkleroot) ? 'YES' : 'NO');
  console.log('  - Equals txid (single tx):', merkleroot === coinbaseTxid ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Merkle root calculation failed:', error.message);
}

// Test 4: Merkle root calculation with multiple transactions
console.log('\nTest 4: Merkle Root Calculation (Multiple Transactions)');
try {
  const mockTxids = [
    'a' + '0'.repeat(63),
    'b' + '0'.repeat(63),
    'c' + '0'.repeat(63),
    'd' + '0'.repeat(63)
  ];
  const merkleroot = bitcoinWorkService.calculateMerkleRoot(mockTxids);
  console.log('✓ Merkle root calculated successfully');
  console.log('  - Input txids:', mockTxids.length);
  console.log('  - Merkle root:', merkleroot);
  console.log('  - Length:', merkleroot.length, 'characters');
  console.log('  - Valid hex:', /^[0-9a-f]{64}$/.test(merkleroot) ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Merkle root calculation failed:', error.message);
}

// Test 5: Merkle root calculation with odd number of transactions
console.log('\nTest 5: Merkle Root Calculation (Odd Transaction Count)');
try {
  const mockTxids = [
    'a' + '0'.repeat(63),
    'b' + '0'.repeat(63),
    'c' + '0'.repeat(63)
  ];
  const merkleroot = bitcoinWorkService.calculateMerkleRoot(mockTxids);
  console.log('✓ Merkle root calculated successfully');
  console.log('  - Input txids:', mockTxids.length, '(odd)');
  console.log('  - Merkle root:', merkleroot);
  console.log('  - Length:', merkleroot.length, 'characters');
  console.log('  - Valid hex:', /^[0-9a-f]{64}$/.test(merkleroot) ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Merkle root calculation failed:', error.message);
}

// Test 6: Device-specific work construction
console.log('\nTest 6: Device-Specific Work Construction');
try {
  const deviceWork = bitcoinWorkService.constructDeviceWork(mockBlockTemplate, extranonce1);
  console.log('✓ Device work constructed successfully');
  console.log('  - Coinbase txid:', deviceWork.coinbaseTxid);
  console.log('  - Merkle root:', deviceWork.merkleroot);
  console.log('  - Total txids:', deviceWork.allTxids.length);
  console.log('  - Merkle root valid hex:', /^[0-9a-f]{64}$/.test(deviceWork.merkleroot) ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Device work construction failed:', error.message);
}

// Test 7: Extranonce uniqueness
console.log('\nTest 7: Extranonce Uniqueness');
try {
  const extranonce1_a = crypto.randomBytes(8).toString('hex');
  const extranonce1_b = crypto.randomBytes(8).toString('hex');
  const work_a = bitcoinWorkService.constructDeviceWork(mockBlockTemplate, extranonce1_a);
  const work_b = bitcoinWorkService.constructDeviceWork(mockBlockTemplate, extranonce1_b);
  
  console.log('✓ Extranonce uniqueness test completed');
  console.log('  - Extranonce A:', extranonce1_a);
  console.log('  - Extranonce B:', extranonce1_b);
  console.log('  - Different:', extranonce1_a !== extranonce1_b ? 'YES' : 'NO');
  console.log('  - Merkle roots different:', work_a.merkleroot !== work_b.merkleroot ? 'YES' : 'NO');
  console.log('  - Coinbase txids different:', work_a.coinbaseTxid !== work_b.coinbaseTxid ? 'YES' : 'NO');
} catch (error) {
  console.log('✗ Extranonce uniqueness test failed:', error.message);
}

console.log('\n=== Verification Tests Complete ===');
