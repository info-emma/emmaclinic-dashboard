import multer from 'multer';
import { parseBuffer } from './_parse.js';

const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, r => (r instanceof Error ? reject(r) : resolve(r)));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await runMiddleware(req, res, upload.single('file'));
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = parseBuffer(req.file.buffer);
    res.json({ ...result, fileName: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
