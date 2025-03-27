#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Checking for common issues in Imager...');

// Create directory if it doesn't exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating missing directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

// Copy file if target doesn't exist
function ensureFile(source, target) {
  if (fs.existsSync(source) && !fs.existsSync(target)) {
    console.log(`Copying ${source} to ${target}`);
    fs.copyFileSync(source, target);
    return true;
  }
  return false;
}

// Update file content if needed
function updateFileIfNeeded(filePath, pattern, replacement) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(pattern)) {
    console.log(`Updating ${filePath}`);
    const newContent = content.replace(pattern, replacement);
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  return false;
}

// Check and fix directory structure
console.log('Checking directory structure...');
let fixes = 0;

// Ensure app directory exists
fixes += ensureDir(path.join(process.cwd(), 'app')) ? 1 : 0;
fixes += ensureDir(path.join(process.cwd(), 'app/api')) ? 1 : 0;

// Ensure basic app files exist
fixes += ensureFile(
  path.join(process.cwd(), 'src/app/layout.tsx'),
  path.join(process.cwd(), 'app/layout.js')
) ? 1 : 0;

fixes += ensureFile(
  path.join(process.cwd(), 'src/app/page.tsx'),
  path.join(process.cwd(), 'app/page.js')
) ? 1 : 0;

// Check for Next.js config issues
console.log('Checking Next.js configuration...');
const nextConfigPath = path.join(process.cwd(), 'next.config.js');
if (fs.existsSync(nextConfigPath)) {
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
  if (!nextConfig.includes('experimental')) {
    console.log('Adding experimental config to next.config.js');
    const updatedConfig = nextConfig.replace(
      'module.exports = nextConfig;',
      `  experimental: {
    // Explicitly tell Next.js to use the src directory
    appDir: true,
  },
  distDir: '.next',
};

module.exports = nextConfig;`
    );
    fs.writeFileSync(nextConfigPath, updatedConfig, 'utf8');
    fixes++;
  }
}

// Clean build artifacts
console.log('Cleaning build artifacts...');
try {
  if (fs.existsSync(path.join(process.cwd(), '.next'))) {
    execSync('rm -rf .next');
    console.log('Removed .next directory');
    fixes++;
  }
} catch (error) {
  console.error('Error cleaning build artifacts:', error.message);
}

// Done
if (fixes > 0) {
  console.log(`✅ Fixed ${fixes} issues. Ready to run 'npm run dev'`);
} else {
  console.log('✅ No issues found. App structure looks good!');
}

// Provide next steps
console.log('\nNext steps:');
console.log('1. Run "npm run dev" to start the development server');
console.log('2. Open http://localhost:3000 in your browser');
console.log('3. If you encounter issues, try "npm run clean" and restart'); 