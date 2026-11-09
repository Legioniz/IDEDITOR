export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Construct the GitHub URL from the request path
  // Vercel strips '/api/proxy' from the path, so we prepend 'https://github.com'
  const targetUrl = 'https://github.com' + req.url;
  
  try {
    // 3. Fetch from GitHub with a valid Git User-Agent
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: 'github.com',
        // This is the critical fix for the 404 error
        'User-Agent': 'git/2.39.2',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });
    
    // 4. Stream the response back to the client
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}