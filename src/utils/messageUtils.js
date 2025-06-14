import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

class MessageService {
  constructor() {
    this.MESSAGE_FILE = path.join(process.cwd(), 'data', 'message.json');
  }

  async readMessageData() {
    try {
      const data = await fs.readFile(this.MESSAGE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading message data:', error);
      return { salutation: "", message: "" };
    }
  }
}

// Export both the class and a default instance
export { MessageService };
export const messageService = new MessageService();

// Also export the function directly for convenience
export async function readMessageData() {
  return await messageService.readMessageData();
}