const { spawn } = require('child_process');
const path = require('path');

const projectRoot = process.cwd();
const node = process.execPath;

const commands = [
  { name: 'SERVER', script: path.join(projectRoot, 'server', 'index.js') },
  { name: 'CLIENT', command: 'vite', args: ['--host', '0.0.0.0'] },
];

const children = [];

function start(name, command, args = []) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
    windowsHide: false,
    shell: false,
  });
  child.on('error', (err) => {
    console.error(`[${name}] Failed to start: ${err.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}${signal ? ` (${signal})` : ''}`);
    }
  });
  children.push(child);
}

start('SERVER', node, [commands[0].script]);

// Use the local Vite executable directly. On Windows npm.cmd can produce
// EINVAL with child_process.spawn under some Node/npm combinations.
const viteBin = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  : path.join(projectRoot, 'node_modules', '.bin', 'vite');
start('CLIENT', node, [viteBin, '--host', '0.0.0.0']);

console.log('\nVox Mandate is starting...');
console.log('Frontend: http://localhost:5173');
console.log('Backend:  http://localhost:3001');
console.log('Press Ctrl+C to stop both.\n');

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
