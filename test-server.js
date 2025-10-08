// Quick test script to verify server starts
const { spawn } = require('child_process');

console.log('Starting server...');
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: process.env
});

server.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

server.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Wait 8 seconds then test the endpoint
setTimeout(async () => {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  try {
    console.log('\nTesting health endpoint...');
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    console.log('Health check response:', data);

    console.log('\n✅ Server is working!');
    server.kill();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Server test failed:', error.message);
    server.kill();
    process.exit(1);
  }
}, 8000);
