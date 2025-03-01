import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables with enhanced error handling
dotenv.config();

// Also try loading from .env.local if it exists
try {
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  const exists = await fs.access(localEnvPath).then(() => true).catch(() => false);
  if (exists) {
    dotenv.config({ path: localEnvPath });
  }
} catch (error) {
  console.log('No .env.local found, using default environment');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enhanced environment variable loader with build context awareness
const getEnvVar = (key) => {
  // Try different environment variable patterns
  const variants = [
    process.env[key],                    // Direct key
    process.env[`VITE_${key}`],         // Vite prefixed
    process.env[key.replace('VITE_', '')] // Without Vite prefix
  ];

  const value = variants.find(v => v);

  if (!value) {
    const buildContext = process.env.CI ? 'CI/CD' : 'local';
    console.error(`Error: ${key} is not set in environment variables (${buildContext} build)`);
    console.error('Please ensure either .env or .env.local contains the required Firebase configuration');
    return '';
  }

  return value;
};

// Validate Firebase configuration
async function validateFirebaseConfig(config) {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingKeys = requiredKeys.filter(key => !config[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      'Missing required Firebase configuration keys:\n' +
      missingKeys.map(key => `  - ${key}`).join('\n') +
      '\nPlease check your environment variables.'
    );
  }

  // Validate format of specific fields
  if (!/^[A-Za-z0-9-_]+$/.test(config.projectId)) {
    throw new Error('Invalid projectId format. Should only contain alphanumeric characters, hyphens, and underscores.');
  }

  if (!/^\d+$/.test(config.messagingSenderId)) {
    throw new Error('Invalid messagingSenderId format. Should be numeric.');
  }

  return true;
}

async function generateServiceWorker() {
  console.log('Starting service worker configuration generation...');
  try {
    // Read the template
    const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');
    let swContent = await fs.readFile(swPath, 'utf8');

    // Replace environment variables
    const firebaseConfig = {
      apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
      authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('VITE_FIREBASE_APP_ID'),
      measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID')
    };

    // Replace Firebase config values with actual values
    const configReplacements = {
      "VITE_FIREBASE_API_KEY": firebaseConfig.apiKey,
      "VITE_FIREBASE_AUTH_DOMAIN": firebaseConfig.authDomain,
      "VITE_FIREBASE_PROJECT_ID": firebaseConfig.projectId,
      "VITE_FIREBASE_STORAGE_BUCKET": firebaseConfig.storageBucket,
      "VITE_FIREBASE_MESSAGING_SENDER_ID": firebaseConfig.messagingSenderId,
      "VITE_FIREBASE_APP_ID": firebaseConfig.appId,
      "VITE_FIREBASE_MEASUREMENT_ID": firebaseConfig.measurementId
    };

    // Replace each placeholder with its actual value, handling different quote formats
    Object.entries(configReplacements).forEach(([placeholder, value]) => {
      // Handle different quote formats and potential whitespace
      const patterns = [
        new RegExp(`"${placeholder}"`, 'g'),  // "VITE_FIREBASE_API_KEY"
        new RegExp(`'${placeholder}'`, 'g'),  // 'VITE_FIREBASE_API_KEY'
        new RegExp(`${placeholder}`, 'g')     // VITE_FIREBASE_API_KEY
      ];
      
      patterns.forEach(pattern => {
        swContent = swContent.replace(pattern, `"${value}"`);
      });
    });

    // Write the modified content
    // Verify all placeholders were replaced
    const remainingPlaceholders = Object.keys(configReplacements).filter(placeholder =>
      swContent.includes(`"${placeholder}"`)
    );

    if (remainingPlaceholders.length > 0) {
      throw new Error(`Failed to replace Firebase config placeholders: ${remainingPlaceholders.join(', ')}`);
    }

    // Verify no empty values
    const emptyValues = Object.entries(configReplacements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyValues.length > 0) {
      throw new Error(`Missing Firebase config values for: ${emptyValues.join(', ')}`);
    }

    await fs.writeFile(swPath, swContent);
    console.log('Firebase messaging service worker configuration verified and updated successfully');
  } catch (error) {
    console.error('Error generating service worker:', error);
    process.exit(1);
  }
}

generateServiceWorker();