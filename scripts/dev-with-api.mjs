import { spawn } from 'node:child_process';
import net from 'node:net';

const API_PORT = Number(process.env.PORT || 8787);
const viteArgs = ['vite', ...process.argv.slice(2)];
const children = new Set();

const isPortOpen = (port) => new Promise((resolve) => {
  const socket = net.createConnection({ port, host: '127.0.0.1' });
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
});

const run = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options,
  });
  children.add(child);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code && code !== 0) {
      console.error(`${command} exited with code ${code}${signal ? ` (${signal})` : ''}`);
      shutdown(code);
    }
  });
  return child;
};

let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 100);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (await isPortOpen(API_PORT)) {
  console.log(`API already available on http://localhost:${API_PORT}`);
} else {
  run('node', ['server/index.js']);
}

run('npx', viteArgs);
