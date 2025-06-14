// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDirectoryExists, initializeMessageFile } from './src/utils/fileUtils.js';
import { createUploadMiddleware } from './src/middleware/upload.js';
import whatsappRoutes from './src/routes/whatsappRoutes.js';
import { WhatsAppService } from './src/services/WhatsAppService.js';
import { ContactService } from './src/services/ContactService.js';
import { MessageService } from './src/utils/messageUtils.js';
// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000 || env.port;

// Initialize services
const whatsappService = new WhatsAppService();
const contactService = new ContactService(__dirname);
const messageService = new MessageService()
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/bot', whatsappRoutes(whatsappService, contactService,messageService ,createUploadMiddleware()));

// Root route - Fixed
app.get('/', (req, res) => {
  try {
    // Don't initialize client here, just check status
    const status = whatsappService.getStatus();
    res.status(200).json({ 
      connected: status.status === 'connected',
      clientInitialized: status.client === 'initialized',
      message: 'WhatsApp Bot Server is running. Visit /bot/qr to generate QR code.'
    });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ 
      connected: false,
      error: 'Failed to check WhatsApp status'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 500,
    message: 'Internal server error',
    error: err.message
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    if (whatsappService.client) {
      await whatsappService.client.destroy();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  try {
    if (whatsappService.client) {
      await whatsappService.client.destroy();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

// Start the server
(async () => {
  try {
    const CONTACTS_FILE = path.join(__dirname, 'contacts.xlsx');
    
    // Initialize directory and file structure
    await ensureDirectoryExists(path.dirname(CONTACTS_FILE));
    await initializeMessageFile(__dirname);
    
    // Create contacts file if it doesn't exist
    await contactService.initializeContactsFile();
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Visit http://localhost:${port}/bot/qr to generate QR code`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();