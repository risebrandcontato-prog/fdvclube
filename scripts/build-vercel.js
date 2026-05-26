const fs = require('fs');
const path = require('path');

console.log('[build-vercel] Preparing Vercel output...');

// Clean previous
if (fs.existsSync('output')) {
  fs.rmSync('output', { recursive: true });
}

// Create structure that Vercel expects
fs.mkdirSync('output/static', { recursive: true });
fs.mkdirSync('output/functions/index.func', { recursive: true });

// Copy static assets
const clientDir = 'dist/client';
if (fs.existsSync(clientDir)) {
  const files = fs.readdirSync(clientDir);
  for (const file of files) {
    const src = path.join(clientDir, file);
    const dest = path.join('output/static', file);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// Copy server function
const serverEntry = 'dist/server/index.js';
if (fs.existsSync(serverEntry)) {
  fs.copyFileSync(serverEntry, 'output/functions/index.func/index.js');
} else {
  console.error('[build-vercel] ERROR: dist/server/index.js not found!');
  process.exit(1);
}

// Create function config
fs.writeFileSync('output/functions/index.func/.vc-config.json', JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true
}, null, 2));

// Create routing config
fs.writeFileSync('output/config.json', JSON.stringify({
  version: 3,
  routes: [
    {
      src: '/assets/(.*)',
      dest: '/assets/$1',
      headers: {
        'cache-control': 'public, max-age=31536000, immutable'
      }
    },
    {
      handle: 'filesystem'
    },
    {
      src: '/(.*)',
      dest: '/index'
    }
  ]
}, null, 2));

console.log('[build-vercel] Done! Output ready in output/');