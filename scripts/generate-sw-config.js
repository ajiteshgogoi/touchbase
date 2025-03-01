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
    const swPath = path.join(__dirname, '../public/sw.js');
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

    // Map each environment variable to its value
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      const envKey = `VITE_FIREBASE_${key.toUpperCase()}`;
      swContent = swContent.replace(`"${envKey}"`, `"${value}"`);
    });

    // Write the modified content
    await fs.writeFile(swPath, swContent);
    console.log('Firebase messaging service worker configured successfully');
  } catch (error) {
    console.error('Error generating service worker:', error);
    process.exit(1);
  }
}

generateServiceWorker();