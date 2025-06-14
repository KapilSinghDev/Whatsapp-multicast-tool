// src/controllers/WhatsAppController.js
import { unlinkSync, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';

const { MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhatsAppController {
  constructor(whatsappService, contactService, messageService) {
    this.whatsappService = whatsappService;
    this.contactService = contactService;
    this.messageService = messageService;
  }

  async generateQR(req, res) {
    try {
      await this.whatsappService.generateQRCode(res);
    } catch (error) {
      console.error('Error generating QR:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to generate QR code',
        error: error.message
      });
    }
  }

  async uploadContacts(req, res) {
    let csvFilePath = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 400,
          message: 'No file uploaded',
        });
      }
      
      csvFilePath = req.file.path;
      const result = await this.contactService.processContactsFile(csvFilePath);
      
      // Clean up the uploaded file
      unlinkSync(csvFilePath);
      
      res.status(200).json({
        status: 200,
        message: 'File processed successfully',
        newContactsAdded: result.newContactsAdded,
        repeatedContacts: result.repeatedContacts
      });
    } catch (error) {
      console.error('Error uploading contacts:', error);
      
      // Clean up the uploaded file if it exists
      if (csvFilePath && existsSync(csvFilePath)) {
        unlinkSync(csvFilePath);
      }
      
      res.status(500).json({
        status: 500,
        message: 'Failed to process CSV',
        error: error.message,
      });
    }
  }

  async uploadMedia(req, res) {
    let mediaFile = null;
    
    try {
      mediaFile = req.files['media']?.[0];
      if (!mediaFile) {
        return res.status(401).json({
          status: 401,
          message: 'Media was not received'
        });
      }

      await this.contactService.saveMedia(mediaFile);
      
      res.status(200).json({
        status: 200,
        message: 'Media uploaded successfully'
      });
    } catch (error) {
      console.error('Error handling media upload:', error);
      
      // Clean up the uploaded file if it exists
      if (mediaFile && existsSync(mediaFile.path)) {
        unlinkSync(mediaFile.path);
      }
      
      res.status(500).json({
        status: 500,
        message: 'Failed to process media',
        error: error.message
      });
    }
  }

  async setSalutations(req, res) {
    try {
      const { message, salutation } = req.body;
      
      const success = await this.contactService.storeCustomDetails(salutation, message);
      
      if (success) {
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
  }

  async startMessaging(req, res) {
    try {
      const { option, useImage } = req.body;

      if (option !== 'start' && useImage == false) {
        return res.status(403).json({
          status: 403,
          message: 'Not permitted to start',
        });
      }

      // Check if client is initialized and ready
      if (!this.whatsappService.isClientReady()) {
        return res.status(400).json({
          status: 400,
          message: 'WhatsApp client is not initialized or not ready',
          suggestion: 'Please scan the QR code at /bot/qr endpoint first'
        });
      }

      const contacts = this.contactService.readContactsFromExcel();
      const unsentContacts = contacts.filter(contact => !contact.sent);

      if (unsentContacts.length === 0) {
        return res.status(200).json({
          status: 200,
          message: 'No unsent contacts found',
          totalMessagesSent: 0,
        });
      }

      // Use the WhatsAppService's sendBulkMessages method instead of duplicating logic
      const results = await this.whatsappService.sendBulkMessages(useImage);

      res.status(200).json({
        status: 200,
        message: 'Messages processing completed',
        totalMessagesSent: results.sent,
        totalMessagesFailed: results.failed,
        details: results.errors.length > 0 ? results.errors : undefined
      });
    } catch (error) {
      console.error('Error in startMessaging:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to send messages',
        error: error.message,
      });
    }
  }

  async clearData(req, res) {
    try {
      const { contacts, media } = req.body;
      const results = await this.contactService.clearData(contacts, media);
      
      res.status(200).json({
        status: 200,
        message: 'Clear operation completed',
        results: results
      });
    } catch (error) {
      console.error('Error in clearData:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to clear data',
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const { removeAuth } = req.body;
      const result = await this.whatsappService.logout(removeAuth);
      
      res.status(200).json({
        status: 200,
        message: 'Logged out successfully',
        authRemoved: result.authRemoved
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({
        status: 500,
        message: 'Logout failed, but client was forcibly destroyed',
        error: error.message
      });
    }
  }

  getStatus(req, res) {
    const status = this.whatsappService.getStatus();
    res.status(200).json(status);
  }
}