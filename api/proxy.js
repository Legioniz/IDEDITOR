export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Extract the target URL from the request path
  // The client requests: /api/proxy/https://github.com/...
  const targetUrl = req.url.replace(/^\/api\/proxy\//, '');
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL parameter' });
  }
  
  try {
    // 3. Fetch from GitHub with critical headers
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['connection'];
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...headers,
        host: new URL(targetUrl).host,
        'User-Agent': 'git/2.39.2', // Required for GitHub to not return 404
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
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