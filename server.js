import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { createReadStream, existsSync, unlinkSync , readFileSync } from 'fs';
import csv from 'csv-parser';
import XLSX from 'xlsx';
import cors from 'cors';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, LocalAuth, MessageMedia } = pkg;

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });
const CONTACTS_FILE = path.join(__dirname, 'contacts.xlsx');
const MESSAGE_FILE = path.join(__dirname, 'message', 'message.json');

// Ensure message directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EXIST') {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }
}

// Initialize message.json with default values if it doesn't exist
async function initializeMessageFile() {
  const messageDir = path.join(__dirname, 'message');
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

// Initialize WhatsApp client globally
let client = null;
let clientReady = false;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper functions
function readContactsFromExcel(filePath) {
  if (!existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  console.log(sheet)
  return XLSX.utils.sheet_to_json(sheet);
}

function writeContactsToExcel(filePath, contacts) {
  const worksheet = XLSX.utils.json_to_sheet(contacts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  XLSX.writeFile(workbook, filePath);
}

function readContactsFromCSV(filepath) {
  return new Promise((resolve, reject) => {
    const contacts = [];
    createReadStream(filepath)
      .pipe(csv())
      .on('data', (row) => {
        console.log('Raw row data:', row); // Debug: see what the row actually contains
        
        // Check if row.phone is a string or an object
        if (row.phone && typeof row.phone === 'object') {
          // Handle the case where row.phone is already an object (prevent nesting)
          console.log('Phone is an object:', row.phone);
          contacts.push({
            phone: row.phone.phone || '',  // Extract the phone number from the object
            sent: false
          });
        } else if (row.phone && typeof row.phone === 'string') {
          // Normal case: row.phone is a string
          contacts.push({
            phone: row.phone.trim(),
            sent: false
          });
        } else {
          // Try to find any field that might contain a phone number
          let phoneFound = false;
          for (const key in row) {
            const value = row[key];
            if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
              contacts.push({
                phone: value.trim(),
                sent: false
              });
              phoneFound = true;
              break;
            }
          }
          
          if (!phoneFound) {
            console.log('No phone number found in row:', row);
          }
        }
      })
      .on('end', () => {
        console.log(`CSV processing complete. Found ${contacts.length} contacts.`);
        // Let's inspect the structure of the contacts to verify it's correct
        if (contacts.length > 0) {
          console.log('Sample contact structure:', JSON.stringify(contacts[0], null, 2));
        }
        resolve(contacts);
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
}
async function storeCustomDetails(salutation, message) {
  try {
    await ensureDirectoryExists(path.join(__dirname, 'message'));
    const defaultMessage = {
      salutation: salutation || "",
      message: message || ""
    };
    
    await fs.writeFile(MESSAGE_FILE, JSON.stringify(defaultMessage, null, 2), 'utf-8');
    console.log('Message successfully saved.');
    return true;
  } catch (error) {
    console.error('Error handling the file:', error);
    return false;
  }
}

async function readMessageData() {
  try {
    const data = await fs.readFile(MESSAGE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading message data:', error);
    return { salutation: "", message: "" };
  }
}

// Initialize WhatsApp client function
function initializeWhatsAppClient() {
  if (client) {
    return client;
  }
  
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox']
    }
  });
  
  client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    clientReady = true;
  });
  
  client.on('disconnected', () => {
    console.log('WhatsApp client disconnected');
    clientReady = false;
    client = null;
  });
  
  client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    client = null;
  });
  
  return client;
}

// Routes
app.get('/', (req, res) => {
  const connetionStatus = initializeWhatsAppClient()
  if(connetionStatus){
    res.status(200).json({ connected: true });
  }
  res.status(400).json({ connected: false });
});

app.get('/bot/qr', (req, res) => {
  // Clean up existing client if it exists but isn't ready
  if (client && !clientReady) {
    client.destroy();
    client = null;
  }
  
  // Initialize a new client
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox']
    }
  });
  
  let qrSent = false; // prevent multiple res.send()
  
  client.on('qr', async (qr) => {
    if (qrSent) return;
    
    try {
      console.log('QR Code received:', qr);
      const qrImageUrl = await qrcode.toDataURL(qr); // convert to image
      qrSent = true;
      
      res.status(200).send(`
        <html>
          <body>
            <h2>Scan the QR code with WhatsApp</h2>
            <img src="${qrImageUrl}" />
          </body>
        </html>
      `);
    } catch (err) {
      if (!qrSent) {
        qrSent = true;
        res.status(500).send('Failed to generate QR code: ' + err.message);
      }
    }
  });
  
  client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    clientReady = true;
    // If the QR wasn't sent yet, send a success message
    if (!qrSent) {
      qrSent = true;
      res.status(200).send('WhatsApp is already authenticated!');
    }
  });
  
  client.on('authenticated', () => {
    console.log('WhatsApp client is authenticated!');
  });
  
  client.on('auth_failure', (err) => {
    console.error('WhatsApp authentication failed:', err);
    if (!qrSent) {
      qrSent = true;
      res.status(500).send('Authentication failed: ' + err.message);
    }
  });
  
  // Start the client
  client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    if (!qrSent) {
      qrSent = true;
      res.status(500).send('Failed to initialize WhatsApp client: ' + err.message);
    }
  });
  
  // Set timeout in case no events are triggered
  setTimeout(() => {
    if (!qrSent) {
      qrSent = true;
      res.status(500).send('Timeout waiting for WhatsApp events');
    }
  }, 30000);
});

// to take the csv of the contacts 
// Note : the contacts should have 91 in the start
// app.post('/bot/numbers', upload.single('file'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         status: 400,
//         message: 'No file uploaded',
//       });
//     }
    
//     const csvFilePath = req.file.path;
//     const newContacts = await readContactsFromCSV(csvFilePath);
//     const existingContacts = readContactsFromExcel(CONTACTS_FILE);
//     const existingNumbers = new Set(existingContacts.map(contact => contact.phone));
//     const uniqueNewContacts = newContacts
//       .filter(number => !existingNumbers.has(number))
//       .map(number => ({ phone: number, sent: false }));

//     const updatedContacts = [...existingContacts, ...uniqueNewContacts];
//     console.log('uploaded contacts -> ' , updatedContacts)
//     writeContactsToExcel(CONTACTS_FILE, updatedContacts);

//     // Clean up the uploaded file
//     unlinkSync(csvFilePath);

//     res.status(200).json({
//       status: 200,
//       message: 'File processed successfully',
//       newContactsAdded: uniqueNewContacts.length,
//     });
//   } catch (error) {
//     console.error(error);
//     // Clean up the uploaded file if it exists
//     if (req.file && existsSync(req.file.path)) {
//       unlinkSync(req.file.path);
//     }
    
//     res.status(500).json({
//       status: 500,
//       message: 'Failed to process CSV',
//       error: error.message,
//     });
//   }
// });

app.post('/bot/numbers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: 'No file uploaded',
      });
    }
    
    const csvFilePath = req.file.path;
    const newContacts = await readContactsFromCSV(csvFilePath);
    
    console.log('Uploaded contacts before normalization:', newContacts);
    
    // Normalize the contacts to fix nested structure issues
    const normalizedContacts = newContacts.map(contact => {
      // If contact.phone is an object with a phone property, flatten it
      if (typeof contact.phone === 'object' && contact.phone !== null && contact.phone.phone) {
        return {
          phone: contact.phone.phone,
          sent: false
        };
      }
      // Otherwise keep the structure as is
      return {
        phone: contact.phone,
        sent: false
      };
    });
    
    console.log('Normalized contacts:', normalizedContacts);
    
    // Make sure the contacts file exists before trying to read from it
    let existingContacts = [];
    if (existsSync(CONTACTS_FILE)) {
      existingContacts = readContactsFromExcel(CONTACTS_FILE);
    }
    
    const existingNumbers = new Set(existingContacts.map(contact => contact.phone));
    
    // Filter out duplicates
    const uniqueNewContacts = normalizedContacts
      .filter(contact => !existingNumbers.has(contact.phone));
    
    // Combine existing contacts with unique new contacts
    const updatedContacts = [...existingContacts, ...uniqueNewContacts];
    
    console.log('Final contacts to write:', updatedContacts);
    
    // Write the updated contacts back to the Excel file
    writeContactsToExcel(CONTACTS_FILE, updatedContacts);
    
    // Clean up the uploaded file
    unlinkSync(csvFilePath);
    
    res.status(200).json({
      status: 200,
      message: 'File processed successfully',
      newContactsAdded: uniqueNewContacts.length,
    });
  } catch (error) {
    console.error(error);
    // Clean up the uploaded file if it exists
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 500,
      message: 'Failed to process CSV',
      error: error.message,
    });
  }
});

// endpoint that will accept all the things
const mediaMiddleware = upload.fields([
  { name: 'media', maxCount: 1 }
]);

app.post('/bot/media', mediaMiddleware, async (req, res) => {
  try {
    const mediaFile = req.files['media']?.[0];
    if (!mediaFile) {
      return res.status(401).json({
        status: 401,
        message: 'Media was not received'
      });
    }
    console.log('media recieved')
    // Create media directory if it doesn't exist
    const mediaDir = path.join(__dirname, 'assets');
    await ensureDirectoryExists(mediaDir);
    
    // Save the file with original extension
    const fileExt = path.extname(mediaFile.originalname);
    const newFilePath = path.join(mediaDir, 'Promo' + fileExt);
    
    await fs.rename(mediaFile.path, newFilePath);
    
    res.status(200).json({
      status: 200,
      message: 'Media uploaded successfully',
      path: newFilePath
    });
    console.log('upload of photo success')
  } catch (error) {
    console.error('Error handling media upload:', error);
    // Clean up the uploaded file if it exists
    if (req.files && req.files['media'] && req.files['media'][0] && existsSync(req.files['media'][0].path)) {
      unlinkSync(req.files['media'][0].path);
    }
    
    res.status(500).json({
      status: 500,
      message: 'Failed to process media',
      error: error.message
    });
  }
});

app.post('/bot/salutations', async (req, res) => {
  try {
    const customMessage = req.body.message;
    const salutation = req.body.salutation;
    
    if (await storeCustomDetails(salutation, customMessage)) {
      return res.status(201).json({
        status: 201,
        message: 'Salutations and message received successfully'
      });
    }
    
    return res.status(400).json({
      status: 400,
      message: 'Message and salutation could not be stored'
    });
  } catch (error) {
    console.error('Error storing salutations:', error);
    res.status(500).json({
      status: 500,
      message: 'Failed to store salutations',
      error: error.message
    });
  }
});

app.post('/bot/start', async (req, res) => {
  
      // const contacts = readContactsFromExcel(CONTACTS_FILE);
      // const unsentContacts = contacts.filter(contact => !contact.sent);
      // console.log('this is contacts',unsentContacts)

  try {
    const { option } = req.body;
    
    if (option !== 'start') {
      return res.status(403).json({
        status: 403,
        message: 'Not permitted to start',
      });
    }

    // Check if client is initialized and ready
    if (!client || !clientReady) {
      return res.status(400).json({
        status: 400,
        message: 'WhatsApp client is not initialized or not ready',
        suggestion: 'Please scan the QR code at /bot/qr endpoint first'
      });
    }

    const contacts = readContactsFromExcel(CONTACTS_FILE);
    const unsentContacts = contacts.filter(contact => !contact.sent);

    if (unsentContacts.length === 0) {
      return res.status(200).json({
        status: 200,
        message: 'No unsent contacts found',
        totalMessagesSent: 0,
      });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Read message data from file
    const messageData = await readMessageData();
    
    // Find the most recent media file in the media directory
    const mediaDir = path.join(__dirname, 'assets');
    let mediaPath = '';
    
    try {
      await ensureDirectoryExists(mediaDir);
      const files = await fs.readdir(mediaDir);
      if (files.length > 0) {
        // Get the most recently modified file
        const fileStats = await Promise.all(
          files.map(async file => {
            const filePath = path.join(mediaDir, file);
            const stats = await fs.stat(filePath);
            return { file, stats };
          })
        );
        
        const mostRecent = fileStats.sort((a, b) => b.stats.mtime - a.stats.mtime)[0];
        mediaPath = path.join(mediaDir, mostRecent.file);
      } else {
        // Default to a banner in assets folder if no media uploaded
        mediaPath = path.join(__dirname, 'assets', mostRecent);
        // Create assets directory and dummy image if needed for testing
        if (!existsSync(mediaPath)) {
          await ensureDirectoryExists(path.join(__dirname, 'assets'));
          // This would be better handled by having a default image
          console.log('No default banner found.');
        }
      }
    } catch (err) {
      console.error('Error finding media file:', err);
      // Continue without media if there's an error
    }

    for (const contact of unsentContacts) {
      const number = contact.phone;
      // Ensure proper format for WhatsApp numbers
      let chatId = number.replace(/\\D/g, '');
      // Add country code if missing (assuming default is +91)
      if (chatId.length <= 10) {
        chatId = '91' + chatId;
      }
      chatId = chatId + '@c.us';
      
      const salutation = messageData.salutation || '';
      const text = messageData.message || '';
      const caption = 'Hello ' + salutation + ' ' + text;
      console.log(caption)
      try {
        if (existsSync(mediaPath)) {
          const media = MessageMedia.fromFilePath(mediaPath);
          await client.sendMessage(chatId, media, { caption });
        } else {
          // Send text only if no media is available
          await client.sendMessage(chatId, caption);
        }
        
        contact.sent = true;
        results.sent++;
        console.log(`Message sent to ${number}`);
      } catch (err) {
        results.failed++;
        results.errors.push({ number, error: err.message });
        console.error(`Failed to send message to ${number}:`, err.message);
      }
    }

    writeContactsToExcel(CONTACTS_FILE, contacts);

    res.status(200).json({
      status: 200,
      message: 'Messages processing completed',
      totalMessagesSent: results.sent,
      totalMessagesFailed: results.failed,
      details: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (error) {
    console.error('Error in /bot/start:', error);
    res.status(500).json({
      status: 500,
      message: 'Failed to send messages',
      error: error.message,
    });
  }
});

// Logout of WhatsApp
app.post('/bot/logout', async (req, res) => {
  try {
    // Check if client exists
    if (!client) {
      return res.status(400).json({
        status: 400,
        message: 'No active WhatsApp session found'
      });
    }
    
    // Try to logout
    await client.logout();
    console.log('WhatsApp client logged out successfully');
    
    // Destroy the client instance
    await client.destroy();
    client = null;
    clientReady = false;
    
    // Remove authentication data if requested
    const { removeAuth } = req.body;
    if (removeAuth === true) {
      try {
        const authFolder = path.join(__dirname, '.wwebjs_auth');
        if (existsSync(authFolder)) {
          await fs.rm(authFolder, { recursive: true, force: true });
          console.log('Authentication data removed');
        }
      } catch (error) {
        console.error('Failed to remove authentication data:', error);
      }
    }
    
    res.status(200).json({
      status: 200,
      message: 'Logged out successfully',
      authRemoved: removeAuth === true
    });
  } catch (error) {
    console.error('Error during logout:', error);
    
    // Force destroy the client even if logout fails
    try {
      if (client) {
        await client.destroy();
        client = null;
        clientReady = false;
      }
    } catch (destroyError) {
      console.error('Error destroying client:', destroyError);
    }
    
    res.status(500).json({
      status: 500,
      message: 'Logout failed, but client was forcibly destroyed',
      error: error.message
    });
  }
});

app.get('/bot/status', (req, res) => {
  res.status(200).json({
    status: clientReady ? 'connected' : 'disconnected',
    client: client ? 'initialized' : 'not_initialized'
  });
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 500,
    message: 'Internal server error',
    error: err.message
  });
});

// Start the server
(async () => {
  try {
    // Initialize directory and file structure
    await ensureDirectoryExists(path.dirname(CONTACTS_FILE));
    await initializeMessageFile();
    
    // Create contacts file if it doesn't exist
    if (!existsSync(CONTACTS_FILE)) {
      writeContactsToExcel(CONTACTS_FILE, []);
      console.log('Created empty contacts file');
    }
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();