#!/usr/bin/env node
/**
 * Cross-platform Chrome Launcher for Remote Debugging (Port 9222)
 * Supports macOS, Windows, and Linux.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9222;

/**
 * Check if Chrome is already running with remote debugging port.
 */
async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/json/version', method: 'GET', timeout: 800 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Find Chrome executable path across macOS, Windows, and Linux.
 */
function getChromeExecutablePath() {
  const platform = process.platform;

  if (platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    const candidates = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return 'chrome.exe';
  } else {
    // Linux
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return 'google-chrome';
  }

  throw new Error('Google Chrome executable was not found on this system.');
}

async function main() {
  const alreadyRunning = await isPortOpen(PORT);
  if (alreadyRunning) {
    console.log(`[Chrome Debug] Chrome is already running on port ${PORT}.`);
    return;
  }

  const chromePath = getChromeExecutablePath();
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    ...process.argv.slice(2)
  ];

  console.log(`[Chrome Debug] Launching Chrome on port ${PORT}...`);
  console.log(`[Chrome Debug] Executable: ${chromePath}`);

  try {
    const child = spawn(chromePath, chromeArgs, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    console.log(`[Chrome Debug] Chrome launched successfully in background.`);
  } catch (err) {
    console.error(`[Chrome Debug] Failed to launch Chrome:`, err);
    process.exit(1);
  }
}

main();
