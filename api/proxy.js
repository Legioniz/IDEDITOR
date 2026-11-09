export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Get the target URL
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });
  
  try {
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['connection'];
    
    // 3. Fetch from GitHub with critical headers
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...headers,
        host: new URL(targetUrl).host,
        'User-Agent': 'git/2.39.2', // Required for GitHub
      },
      // Ensure body is only sent for methods that allow it
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : (req.body || undefined),
    });
    
    // 4. Stream the response back safely
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}