// api/b2-upload-url.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const B2_KEY_ID = process.env.B2_KEY_ID;
  const B2_APP_KEY = process.env.B2_APP_KEY;
  const B2_BUCKET_ID = process.env.B2_BUCKET_ID; // Find this on the Buckets page in Backblaze

  try {
    // 1. Get Auth Token from Backblaze
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(B2_KEY_ID + ':' + B2_APP_KEY).toString('base64')
      }
    });
    const authData = await authResponse.json();
    const { apiUrl, authorizationToken } = authData;

    // 2. Get an Upload URL
    const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: { 'Authorization': authorizationToken },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID })
    });
    const uploadUrlData = await uploadUrlResponse.json();

    // 3. Send the upload URL and token back to the client
    res.status(200).json(uploadUrlData);

  } catch (error) {
    console.error('Error getting B2 upload URL:', error);
    res.status(500).json({ message: 'Error getting upload URL' });
  }
}
