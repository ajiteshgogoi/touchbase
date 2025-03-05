// This file is used to help clean up service worker caches
console.log('To clean up service worker caches:');
console.log('1. Open Chrome DevTools (F12)');
console.log('2. Go to Application tab');
console.log('3. Select "Service Workers" in the left sidebar');
console.log('4. Click "Unregister" for any existing service workers');
console.log('5. Select "Cache Storage" in the left sidebar');
console.log('6. Right-click on each cache and select "Delete"');
console.log('7. Reload the page to see the new version');

console.log('\nCurrent version from package.json:', process.env.npm_package_version);