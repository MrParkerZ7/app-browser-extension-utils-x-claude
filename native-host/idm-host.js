#!/usr/bin/env node
/**
 * Native Messaging Host for IDM Integration
 *
 * This script receives URLs from the browser extension and sends them to IDM.
 *
 * Protocol: Native messaging uses length-prefixed JSON messages
 * - First 4 bytes: message length (little-endian)
 * - Remaining bytes: JSON message
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// IDM executable path - adjust if installed elsewhere
const IDM_PATHS = [
  'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe',
  'C:\\Program Files\\Internet Download Manager\\IDMan.exe',
  process.env.IDM_PATH // Allow custom path via environment variable
].filter(Boolean);

function findIdmPath() {
  for (const p of IDM_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.alloc(4 + json.length);
  buffer.writeUInt32LE(json.length, 0);
  buffer.write(json, 4);
  process.stdout.write(buffer);
}

function downloadWithIdm(url, downloadPath, filename) {
  const idmPath = findIdmPath();

  if (!idmPath) {
    sendMessage({
      success: false,
      error: 'IDM not found. Please install IDM or set IDM_PATH environment variable.'
    });
    return;
  }

  // Build IDM command line arguments
  // /d URL - download URL
  // /p PATH - save to path
  // /f FILENAME - save as filename
  // /n - turn on silent mode
  // /a - add to download queue
  const args = ['/d', url];

  if (downloadPath) {
    args.push('/p', downloadPath);
  }

  if (filename) {
    args.push('/f', filename);
  }

  args.push('/n'); // Silent mode - start download immediately

  execFile(idmPath, args, (error, stdout, stderr) => {
    if (error) {
      sendMessage({
        success: false,
        error: `IDM execution failed: ${error.message}`
      });
    } else {
      sendMessage({
        success: true,
        message: 'Download started in IDM',
        url: url
      });
    }
  });
}

function processMessage(message) {
  try {
    const { action, url, downloadPath, filename } = message;

    switch (action) {
      case 'download':
        if (!url) {
          sendMessage({ success: false, error: 'URL is required' });
          return;
        }
        downloadWithIdm(url, downloadPath, filename);
        break;

      case 'ping':
        const idmPath = findIdmPath();
        sendMessage({
          success: true,
          idmFound: !!idmPath,
          idmPath: idmPath
        });
        break;

      default:
        sendMessage({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    sendMessage({ success: false, error: err.message });
  }
}

// Read messages from stdin
let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  // Process complete messages
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);

    if (inputBuffer.length >= 4 + messageLength) {
      const messageJson = inputBuffer.slice(4, 4 + messageLength).toString();
      inputBuffer = inputBuffer.slice(4 + messageLength);

      try {
        const message = JSON.parse(messageJson);
        processMessage(message);
      } catch (err) {
        sendMessage({ success: false, error: `Invalid JSON: ${err.message}` });
      }
    } else {
      break; // Wait for more data
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (err) => {
  sendMessage({ success: false, error: `Uncaught exception: ${err.message}` });
  process.exit(1);
});
