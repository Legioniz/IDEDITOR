export const config = {
  api: {
    bodyParser: false, // Prevents Vercel from corrupting Git binary data
  },
};

// Helper to buffer the incoming request body
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // 1. Handle CORS Pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. Extract the target URL
  // Vercel passes the URL via the query parameter because of our vercel.json rewrite
  let targetUrl = req.query.url;
  
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL parameter in path. Received: ' + req.url });
  }
  
  // Reconstruct the query string (e.g., ?service=git-upload-pack)
  // Vercel splits the URL and query params, so we put them back together
  const otherParams = Object.keys(req.query).filter(k => k !== 'url');
  if (otherParams.length > 0) {
    const qs = new URLSearchParams();
    otherParams.forEach(k => qs.append(k, req.query[k]));
    targetUrl += '?' + qs.toString();
  }
  
  try {
    // 3. Prepare headers (remove ones that break the fetch)
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['connection'];
    delete headers['content-length'];
    delete headers['accept-encoding']; // Let fetch handle decompression
    
    // Set the required headers for GitHub
    headers['host'] = new URL(targetUrl).host;
    headers['User-Agent'] = headers['user-agent'] || 'git/2.39.2';
    
    // 4. Buffer the body (fixes streaming 400 errors)
    const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? null : await buffer(req);
    
    // 5. Fetch from GitHub
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: bodyBuffer,
    });
    
    // 6. Send the response back
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Skip headers that Vercel handles automatically
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    const resBuffer = await response.arrayBuffer();
    res.send(Buffer.from(resBuffer));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}