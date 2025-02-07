import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateServiceWorker() {
  try {
    // Read the template
    const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');
    let swContent = await fs.readFile(swPath, 'utf8');

    // Replace environment variables
    const envVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_FIREBASE_MEASUREMENT_ID'
    ];

    envVars.forEach(key => {
      swContent = swContent.replace(key, process.env[key] || '');
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