// src/middleware/upload.js
import multer from 'multer';

export function createUploadMiddleware() {
  return multer({ dest: 'uploads/' });
}