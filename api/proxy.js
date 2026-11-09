const express = require('express');
const corsProxy = require('@isomorphic-git/cors-proxy/middleware.js');

const app = express();

// Mount the official isomorphic-git proxy middleware
app.use(corsProxy({}));

// Export the Express app for Vercel
