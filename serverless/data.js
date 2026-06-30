import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Bundled data (pre-parsed from Excel at build time)
const bundledData = require('./dashboard-data.json');

// In-memory store for user uploads within the same warm instance
let uploadedData = null;

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 's-maxage=0');
  res.json(uploadedData || bundledData);
}

// Export so upload.js can update in-memory store
export function setUploadedData(data) {
  uploadedData = data;
}
