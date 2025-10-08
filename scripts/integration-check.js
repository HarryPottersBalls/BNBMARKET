const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

function checkIntegration() {
  const checks = [
    {
      name: 'WebAssembly Module',
      check: () => {
        const wasmPkgPath = path.join(__dirname, '..', 'wasm-lmsr', 'pkg');
        return fs.existsSync(wasmPkgPath) &&
               fs.readdirSync(wasmPkgPath).some(file => file.endsWith('.wasm'));
      }
    },
    {
      name: 'Logger Configuration',
      check: () => {
        return fs.existsSync(path.join(__dirname, '..', 'config', 'logger.js'));
      }
    },
    {
      name: 'Docker Production Configuration',
      check: () => {
        return fs.existsSync(path.join(__dirname, '..', 'Dockerfile.production')) &&
               fs.existsSync(path.join(__dirname, '..', 'docker-compose.production.yml'));
      }
    },
    {
      name: 'Performance Check Script',
      check: () => {
        return fs.existsSync(path.join(__dirname, 'performance-check.js'));
      }
    }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const passed = check.check();
    logger.info(`Integration Check - ${check.name}: ${passed ? 'PASSED' : 'FAILED'}`);
    allPassed = allPassed && passed;
  });

  return allPassed;
}

// Run the integration check
const result = checkIntegration();
process.exit(result ? 0 : 1);