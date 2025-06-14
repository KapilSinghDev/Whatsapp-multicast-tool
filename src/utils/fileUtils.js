// src/utils/fileUtils.js
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }
}

export async function initializeMessageFile(rootDir) {
  const messageDir = path.join(rootDir, 'message');
  const MESSAGE_FILE = path.join(messageDir, 'message.json');
  
  await ensureDirectoryExists(messageDir);
  
  if (!existsSync(MESSAGE_FILE)) {
    const defaultMessage = {
      salutation: "",
      message: ""
    };
    await fs.writeFile(MESSAGE_FILE, JSON.stringify(defaultMessage, null, 2), 'utf-8');
    console.log('Created default message file');
  }
}