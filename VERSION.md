# Version Management

This project uses a centralized version management system to ensure consistent versioning across all components.

## Version Files

The version number is maintained in the following files and automatically synchronized:
- `version/version.js` - The primary source of version information (with TypeScript declarations)
- `public/manifest.json` - PWA manifest version
- `public/sw.js` - Service worker cache version
- `vite.config.ts` - Cache names in workbox configuration
- `package.json` - NPM package version

## Updating the Version

To update the version number:

```bash
npm run bump-version <new_version>
```

Example:
```bash
npm run bump-version 2.5
```

This will:
1. Update the version in src/constants/version.ts
2. Automatically propagate the version to all dependent files
3. Show which files were changed

## Auto-Update System

The application includes an auto-update system that will:
1. Detect when a new version is available
2. Show a reload prompt to users
3. Update the service worker and cache when reloaded
4. Display the current version in the footer

## Development

When running `npm run dev` or `npm run build`, the version update script will automatically run to ensure all files are synchronized with the current version number.

## Cache Management

To clear service worker caches during development:
```bash
npm run clean-caches
```

This will display instructions for clearing the caches in your browser's developer tools.