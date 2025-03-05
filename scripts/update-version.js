import fs from 'fs/promises';
import { APP_VERSION } from '../version/version.js';

async function updateFiles() {
  console.log('Updating version across files...');
  
  try {
    // Update manifest.json
    const manifestPath = './public/manifest.json';
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.version = APP_VERSION;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Updated manifest.json to version ${APP_VERSION}`);

    // Update service worker cache version
    const swPath = './public/sw.js';
    let swContent = await fs.readFile(swPath, 'utf8');
    swContent = swContent.replace(
      /touchbase-v[\d.]+/g,
      `touchbase-v${APP_VERSION}`
    );
    await fs.writeFile(swPath, swContent);
    console.log(`✓ Updated service worker cache version to ${APP_VERSION}`);

    // Update vite.config.ts cache names
    const vitePath = './vite.config.ts';
    let viteContent = await fs.readFile(vitePath, 'utf8');
    viteContent = viteContent.replace(
      /touchbase-v[\d.]+-/g,
      `touchbase-v${APP_VERSION}-`
    );
    await fs.writeFile(vitePath, viteContent);
    console.log(`✓ Updated vite.config.ts cache names to version ${APP_VERSION}`);

    // Update package.json
    const packagePath = './package.json';
    const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    packageJson.version = `${APP_VERSION}.0`;
    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    console.log(`✓ Updated package.json to version ${APP_VERSION}.0`);

    // Update src/constants/version.js
    const constantsVersionPath = './src/constants/version.js';
    let constantsVersionContent = await fs.readFile(constantsVersionPath, 'utf8');
    constantsVersionContent = constantsVersionContent.replace(
      /export const APP_VERSION = ['"][\d.]+['"];/,
      `export const APP_VERSION = '${APP_VERSION}';`
    );
    await fs.writeFile(constantsVersionPath, constantsVersionContent);
    console.log(`✓ Updated src/constants/version.js to version ${APP_VERSION}`);

    console.log('\nVersion update complete! ✨');
  } catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
  }
}

updateFiles();