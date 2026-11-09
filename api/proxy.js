export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Extract the target URL from the request path
  // The client requests: /api/proxy/https://github.com/...
  let path = req.url;
  
  // Vercel might pass just the path, or the full URL. We handle both.
  if (path.startsWith('/api/proxy/')) {
    path = path.substring('/api/proxy/'.length);
  }
  
  // Ensure the target URL has a protocol
  let targetUrl = path;
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // 3. Fetch from GitHub with a valid User-Agent
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(targetUrl).host,
        'User-Agent': 'git/2.39.2', // Critical for GitHub to not return 404
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