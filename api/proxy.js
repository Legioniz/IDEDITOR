export const config = {
  api: {
    bodyParser: false, // CRITICAL: Prevents Vercel from corrupting the Git binary data
  },
};

export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Extract the target URL from the path
  // isomorphic-git sends: /api/proxy/https://github.com/...
  let targetUrl = req.url;
  if (targetUrl.startsWith('/api/proxy/')) {
    targetUrl = targetUrl.substring('/api/proxy/'.length);
  }
  
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL parameter in path' });
  }
  
  try {
    // 3. Prepare headers (remove ones that break the fetch)
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['connection'];
    delete headers['content-length'];
    headers['host'] = new URL(targetUrl).host;
    headers['User-Agent'] = 'git/2.39.2'; // Required by GitHub
    
    // 4. Fetch from GitHub
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      // Pass the raw stream to preserve the Git binary data
      body: ['GET', 'HEAD'].includes(req.method) ? null : req,
      duplex: 'half' // Required for Node 18+ to stream request bodies
    });
    
    // 5. Send the response back
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Don't forward encoding headers, Vercel handles compression
      if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}