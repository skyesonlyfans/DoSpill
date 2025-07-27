// api/admin-login.js

// This function runs on the server and securely checks credentials.
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get the username and password from the request body
  const { username, password } = req.body;

  // Get the secure environment variables from Vercel
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  // Check if the provided credentials match the environment variables
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // If they match, send a success response
    res.status(200).json({ success: true });
  } else {
    // If they don't match, send an unauthorized error
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
}
