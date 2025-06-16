// src/services/WhatsAppService.js
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { ContactService } from './ContactService.js';

const { Client, LocalAuth, MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhatsAppService {
  constructor() {
    this.client = null;
    this.clientReady = false;
    this.isInitializing = false;
    this.contactService = new ContactService(path.dirname(path.dirname(__dirname)));
  }

  initializeClient() {
    // Prevent multiple initializations
    if (this.client || this.isInitializing) {
      return this.client;
    }
    
    this.isInitializing = true;
    
    try {
      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });
      
      this.client.on('ready', () => {
        console.log('WhatsApp client is ready!');
        this.clientReady = true;
        this.isInitializing = false;
      });
      
      this.client.on('disconnected', (reason) => {
        console.log('WhatsApp client disconnected:', reason);
        this.clientReady = false;
        this.isInitializing = false;
        this.client = null;
      });

      this.client.on('auth_failure', (error) => {
        console.error('WhatsApp authentication failed:', error);
        this.clientReady = false;
        this.isInitializing = false;
        this.client = null;
      });
      
      this.client.initialize().catch(err => {
        console.error('Failed to initialize WhatsApp client:', err);
        this.clientReady = false;
        this.isInitializing = false;
        this.client = null;
      });
      
    } catch (error) {
      console.error('Error creating WhatsApp client:', error);
      this.clientReady = false;
      this.isInitializing = false;
      this.client = null;
    }
    
    return this.client;
  }

async generateQRCode(res) {
  let qrSent = false; // Prevent multiple res.send()
  let timeoutId = null;

  try {
    // Clean up existing client if it exists
    if (this.client) {
      try {
        // Check if client has pupPage before calling destroy
        if (this.client.pupPage || this.client.info) {
          await this.client.destroy();
        }
      } catch (destroyError) {
        console.warn('Error destroying existing client:', destroyError);
        // Continue anyway - don't let destroy errors block new client creation
      }
      this.client = null;
      this.clientReady = false;
      this.isInitializing = false;
    }

    // Set timeout early to ensure it's always set
    timeoutId = setTimeout(() => {
      if (!res.headersSent && !qrSent) {
        qrSent = true;
        res.status(500).send('Timeout waiting for WhatsApp events');
      }
    }, 60000);

    // Initialize a new client
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Set up event handlers BEFORE initializing
    this.client.on('qr', async (qr) => {
      if (qrSent) return;

      try {
        console.log('QR Code received');
        const qrImageUrl = await qrcode.toDataURL(qr);
        
        if (!res.headersSent) {
          qrSent = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          res.status(200).send(`
            <html>
              <head>
                <title>WhatsApp QR Code</title>
                <meta http-equiv="refresh" content="30">
              </head>
              <body style="text-align: center; font-family: Arial, sans-serif;">
                <img src="${qrImageUrl}" alt="WhatsApp QR Code" />
                <p>This page will refresh automatically every 30 seconds</p>
              </body>
            </html>
          `);
        }
      } catch (err) {
        console.error('Error generating QR code image:', err);
        if (!res.headersSent && !qrSent) {
          qrSent = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          res.status(500).send('Failed to generate QR code: ' + err.message);
        }
      }
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.clientReady = true;
      
      if (!res.headersSent && !qrSent) {
        qrSent = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        res.status(200).send(`
          <html>
            <body style="text-align: center; font-family: Arial, sans-serif;">
              <h2>WhatsApp is already authenticated!</h2>
              <p>Your WhatsApp bot is ready to use.</p>
              <a href="/bot/status">Check Status</a>
            </body>
          </html>
        `);
      }
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client is authenticated!');
    });

    this.client.on('auth_failure', (err) => {
      console.error('WhatsApp authentication failed:', err);
      
      if (!res.headersSent && !qrSent) {
        qrSent = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        res.status(500).send('Authentication failed: ' + err.message);
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected during QR generation:', reason);
      this.clientReady = false;
      // Don't set client to null here as it might be used elsewhere
    });

    // Add error handler for client initialization errors
    this.client.on('error', (error) => {
      console.error('WhatsApp client error:', error);
      
      if (!res.headersSent && !qrSent) {
        qrSent = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        res.status(500).send('WhatsApp client error: ' + error.message);
      }
    });

    // Start the client initialization
    this.isInitializing = true;
    await this.client.initialize();

  } catch (err) {
    console.error('Failed to initialize WhatsApp client for QR:', err);
    
    // Clean up timeout if it exists
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Reset state
    this.clientReady = false;
    this.isInitializing = false;
    
    if (!res.headersSent && !qrSent) {
      qrSent = true;
      res.status(500).send('Failed to initialize WhatsApp client: ' + err.message);
    }
  }
}

  isClientReady() {
    return this.client && this.clientReady;
  }

  async sendBulkMessages(useImage = false) {
    if (!this.isClientReady()) {
      throw new Error('WhatsApp client is not ready. Please scan QR code first.');
    }

    const contacts = this.contactService.readContactsFromExcel();
    const unsentContacts = contacts.filter(contact => !contact.sent);

    if (unsentContacts.length === 0) {
      return { sent: 0, failed: 0, errors: [] };
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Use ContactService's readMessageData method
    const messageData = await this.contactService.readMessageData();
    const mediaPath = await this.contactService.getLatestMediaPath();

    for (const contact of unsentContacts) {
      const number = contact.phone;
      let chatId = number.replace(/\D/g, '');
      
      // Add country code if missing (assuming default is +91)
      if (chatId.length <= 10) {
        chatId = '91' + chatId;
      }
      chatId = chatId + '@c.us';
      
      let salutation = contact.name;
      if (salutation === 'NULL') {
        salutation = messageData.salutation;
      }
      
      const text = messageData.message || '';
      const caption = salutation + ' ' + text;

      try {
        const isHiddenFile = filePath => path.basename(filePath).startsWith('.');
        
        if (!isHiddenFile(mediaPath) && existsSync(mediaPath) && useImage === true) {
          const media = MessageMedia.fromFilePath(mediaPath);
          
          if (!media) {
            throw new Error('No poster found to be used. Please upload a poster first.');
          }
          
          await this.client.sendMessage(chatId, media, { caption });
          console.log('sent media message');
        } else {
          await this.client.sendMessage(chatId, caption);
          console.log('sent text message');
        }
        
        contact.sent = true;
        results.sent++;
        console.log(`Message sent to ${number}`);
        
        // Add delay between messages to avoid being blocked
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err) {
        results.failed++;
        results.errors.push({ number, error: err.message });
        console.error(`Failed to send message to ${number}:`, err.message);
      }
    }

    console.log('contacts to update ->', unsentContacts);
    this.contactService.updateContactStatusInExcel(unsentContacts, true);

    return results;
  }

  async logout(removeAuth = false) {
    if (!this.client) {
      throw new Error('No active WhatsApp session found');
    }
    
    try {
      await this.client.logout();
      console.log('WhatsApp client logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    try {
      await this.client.destroy();
    } catch (error) {
      console.error('Error destroying client:', error);
    }
    
    this.client = null;
    this.clientReady = false;
    this.isInitializing = false;
    
    let authRemoved = false;
    if (removeAuth === true) {
      try {
        const authFolder = path.join(path.dirname(path.dirname(__dirname)), '.wwebjs_auth');
        if (existsSync(authFolder)) {
          await fs.rm(authFolder, { recursive: true, force: true });
          console.log('Authentication data removed');
          authRemoved = true;
        }
      } catch (error) {
        console.error('Failed to remove authentication data:', error);
      }
    }
    
    return { authRemoved };
  }

  getStatus() {
    return {
      status: this.clientReady ? 'connected' : 'disconnected',
      client: this.client ? 'initialized' : 'not_initialized',
      initializing: this.isInitializing
    };
  }
}