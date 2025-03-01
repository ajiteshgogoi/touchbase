import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables with fallbacks
const getEnvVar = (key) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Warning: ${key} is not set in environment variables`);
    return '';
  }
  return value;
};

async function generateServiceWorker() {
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

    // Replace Firebase config values maintaining the exact placeholder format
    const configReplacements = {
      "VITE_FIREBASE_API_KEY": firebaseConfig.apiKey,
      "VITE_FIREBASE_AUTH_DOMAIN": firebaseConfig.authDomain,
      "VITE_FIREBASE_PROJECT_ID": firebaseConfig.projectId,
      "VITE_FIREBASE_STORAGE_BUCKET": firebaseConfig.storageBucket,
      "VITE_FIREBASE_MESSAGING_SENDER_ID": firebaseConfig.messagingSenderId,
      "VITE_FIREBASE_APP_ID": firebaseConfig.appId,
      "VITE_FIREBASE_MEASUREMENT_ID": firebaseConfig.measurementId
    };

    // Replace each placeholder with its actual value
    Object.entries(configReplacements).forEach(([placeholder, value]) => {
      swContent = swContent.replace(`"${placeholder}"`, `"${value}"`);
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