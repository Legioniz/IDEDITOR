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
  const rawTargetUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (typeof rawTargetUrl !== 'string' || !rawTargetUrl.trim()) {
    return res.status(400).json({ error: 'Missing URL parameter. Expected an absolute http(s) URL.' });
  }

  let targetUrl;

  try {
    targetUrl = new URL(rawTargetUrl.trim());
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL parameter. Expected an absolute http(s) URL.' });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Invalid URL parameter. Expected an absolute http(s) URL.' });
  }
  
  // Reconstruct the query string (e.g., ?service=git-upload-pack)
  // Vercel may split the target URL's query parameters from the `url` value.
  // Append them to the parsed URL rather than creating a second `?`.
  const otherParams = Object.keys(req.query).filter(k => k !== 'url');
  otherParams.forEach((key) => {
    const values = Array.isArray(req.query[key]) ? req.query[key] : [req.query[key]];
    values.forEach((value) => {
      if (value !== undefined && value !== null && !targetUrl.searchParams.has(key)) {
        targetUrl.searchParams.append(key, value);
      }
    });
  });
  
  try {
    // 3. Prepare headers (remove ones that break the fetch)
    const headers = {};
    for (const name of ['accept', 'authorization', 'content-type', 'git-protocol', 'user-agent']) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    headers['user-agent'] = headers['user-agent'] || 'git/2.39.2';
    
    // 4. Buffer the body (fixes streaming 400 errors)
    const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? null : await buffer(req);
    
    // 5. Fetch from GitHub
    const response = await fetch(targetUrl.toString(), {
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
    res.status(502).json({ error: `Unable to reach Git remote: ${error.message}` });
  }
}