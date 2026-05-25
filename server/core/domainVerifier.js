/**
 * Bitmind Domain Verifier - Optional Safe Check
 * Verifies domain health and compares with local health
 */

const https = require('https');

// Configuration
const DOMAIN = 'getbitmind.com';
const DOMAIN_HEALTH_PATH = '/health';
const DOMAIN_CHECK_TIMEOUT_MS = 5000;

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[DOMAIN_VERIFIER ${timestamp}] [${level}] ${message}`);
}

/**
 * Check domain health
 */
function checkDomainHealth() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const options = {
      hostname: DOMAIN,
      port: 443,
      path: DOMAIN_HEALTH_PATH,
      method: 'GET',
      timeout: DOMAIN_CHECK_TIMEOUT_MS
    };

    const req = https.request(options, (res) => {
      const latency = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        log(`Domain health check PASS (${latency}ms)`);
        resolve({ ok: true, latency, statusCode: res.statusCode });
      } else {
        log(`Domain health check FAIL (status ${res.statusCode})`, 'WARN');
        resolve({ ok: false, latency, statusCode: res.statusCode });
      }
    });

    req.on('error', (err) => {
      log(`Domain health check ERROR: ${err.message}`, 'WARN');
      resolve({ ok: false, latency: Date.now() - startTime, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      log('Domain health check TIMEOUT', 'WARN');
      resolve({ ok: false, latency: Date.now() - startTime, error: 'timeout' });
    });

    req.end();
  });
}

/**
 * Compare local health with domain health
 */
async function compareHealth(localHealth) {
  try {
    const domainHealth = await checkDomainHealth();
    
    const comparison = {
      local: localHealth,
      domain: domainHealth,
      match: localHealth.ok === domainHealth.ok,
      timestamp: new Date().toISOString()
    };
    
    if (!comparison.match) {
      log(`Health mismatch detected - Local: ${localHealth.ok}, Domain: ${domainHealth.ok}`, 'WARN');
    }
    
    return comparison;
  } catch (error) {
    log(`Domain comparison failed: ${error.message}`, 'ERROR');
    return {
      local: localHealth,
      domain: { ok: false, error: error.message },
      match: false,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get domain status
 */
async function getDomainStatus() {
  const health = await checkDomainHealth();
  return {
    domain: DOMAIN,
    status: health.ok ? 'ok' : 'degraded',
    latency: health.latency,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  checkDomainHealth,
  compareHealth,
  getDomainStatus
};
