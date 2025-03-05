import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

async function bumpVersion(newVersion) {
  if (!newVersion) {
    console.error('Please provide a new version number');
    console.log('Usage: node scripts/bump-version.js <new_version>');
    process.exit(1);
  }

  console.log(`Bumping version to ${newVersion}...`);

  try {
    // Update version.ts
    const versionPath = './version/version.js';
    let content = await fs.readFile(versionPath, 'utf8');
    content = content.replace(
      /export const APP_VERSION = ['"][\d.]+['"];/,
      `export const APP_VERSION = '${newVersion}';`
    );
    await fs.writeFile(versionPath, content);
    console.log(`✓ Updated version.ts`);

    // Run the update-version script
    console.log('\nRunning version update script...');
    execSync('node scripts/update-version.js', { stdio: 'inherit' });

    // Show git diff of changed files
    console.log('\nFiles changed:');
    try {
      execSync('git diff --name-only', { stdio: 'inherit' });
    } catch (error) {
      // Git diff might fail if not in a git repo, ignore
    }

    console.log('\nVersion bump complete! 🚀');
    console.log('Run `npm run dev` to test the changes');
  } catch (error) {
    console.error('Error bumping version:', error);
    process.exit(1);
  }
}

bumpVersion(process.argv[2]);