// api/get-firebase-config.js

// This function runs on the server and securely provides the public
// Firebase config keys to the client application.
export default async function handler(req, res) {
  // These variables need to be set in your Vercel project settings.
  // The `NEXT_PUBLIC_` prefix is a convention Vercel uses to expose
  // variables to the browser-side environment during the build process,
  // but here we are serving them from a secure API endpoint at runtime.
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  // Check if all required keys are present
  for (const key in firebaseConfig) {
    if (!firebaseConfig[key]) {
      console.error(`Missing Firebase config environment variable: ${key}`);
      return res.status(500).json({ error: 'Server configuration error.' });
    }
  }

  res.status(200).json(firebaseConfig);
}
