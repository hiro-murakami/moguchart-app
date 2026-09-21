#!/usr/bin/env node
/**
 * Chrome Remote Debugging Helper (Port 9222)
 *
 * Usage:
 *   node scripts/debug-chrome.mjs list
 *   node scripts/debug-chrome.mjs open <url>
 *   node scripts/debug-chrome.mjs screenshot [outputPath]
 *   node scripts/debug-chrome.mjs eval "<code>"
 */

import http from 'node:http';
import fs from 'node:fs';

const PORT = 9222;

async function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path, method }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getMoguchartPage() {
  const tabs = await request('/json/list');
  if (!Array.isArray(tabs)) throw new Error('Could not fetch tabs');
  return tabs.find(t => t.url && (t.url.includes('localhost:5173') || t.url.includes('localhost:5174') || t.url.includes('moguchart')));
}

async function sendCdp(wsUrl, method, params = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  return new Promise((resolve, reject) => {
    const id = 1;
    ws.addEventListener('message', (event) => {
      const res = JSON.parse(event.data);
      if (res.id === id) {
        ws.close();
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const [,, command, ...args] = process.argv;

try {
  if (!command || command === 'list') {
    const tabs = await request('/json/list');
    console.log(JSON.stringify(tabs, null, 2));
  } else if (command === 'open') {
    const targetUrl = args[0] || 'http://localhost:5173/';
    const result = await request(`/json/new?${encodeURIComponent(targetUrl)}`, 'PUT');
    console.log('Opened:', result);
  } else if (command === 'screenshot') {
    const page = await getMoguchartPage();
    if (!page) {
      console.error('No moguchart tab found. Open one first with: open <url>');
      process.exit(1);
    }
    const outputPath = args[0] || 'screenshot.png';
    const result = await sendCdp(page.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
    console.log(`Saved screenshot to ${outputPath}`);
  } else if (command === 'eval') {
    const page = await getMoguchartPage();
    if (!page) {
      console.error('No moguchart tab found.');
      process.exit(1);
    }
    const expr = args.join(' ');
    const result = await sendCdp(page.webSocketDebuggerUrl, 'Runtime.evaluate', { expression: expr, returnByValue: true });
    console.log(result);
  } else {
    console.log('Unknown command:', command);
  }
} catch (e) {
  console.error('Error connecting to Chrome on port 9222:', e.message);
  console.error('Make sure Chrome is running with --remote-debugging-port=9222 (e.g. pnpm chrome:debug)');
  process.exit(1);
}
