// This file is deprecated and has been consolidated into firebase-messaging-sw.js
// Keeping this file temporarily to prevent 404 errors for existing users
// TODO: Remove this file in next major version
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());