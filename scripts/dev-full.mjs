#!/usr/bin/env node

import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const children = new Set();
let shuttingDown = false;

function prefixStream(name, stream, output) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.length > 0) {
        output.write(`[${name}] ${line}\n`);
      }
    }
  });
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  child.kill('SIGTERM');
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write('[dev-full] stopping local dev servers...\n');
  for (const child of children) {
    stopChild(child);
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
}

function start(name, script) {
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', 'npm', 'run', script]
    : ['run', script];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  children.add(child);
  prefixStream(name, child.stdout, process.stdout);
  prefixStream(name, child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      process.stderr.write(`[dev-full] ${name} exited unexpectedly (${reason}).\n`);
      shutdown(code === 0 || code === null ? 1 : code);
    }
  });

  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  process.stderr.write(`[dev-full] ${error instanceof Error ? error.message : String(error)}\n`);
  shutdown(1);
});

process.stdout.write('[dev-full] starting API server on http://127.0.0.1:8787...\n');
start('api', 'dev:server');

setTimeout(() => {
  if (shuttingDown) return;
  process.stdout.write('[dev-full] starting web dev server on http://localhost:5174...\n');
  start('web', 'dev');
  process.stdout.write('[dev-full] local dev servers are starting. Press Ctrl+C to stop both.\n');
}, 2000);
