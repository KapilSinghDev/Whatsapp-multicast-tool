// src/routes/whatsappRoutes.js
import express from 'express';
import { WhatsAppController } from '../controllers/WhatsAppController.js';

export default function whatsappRoutes(whatsappService, contactService,messageService ,uploadMiddleware) {
  const router = express.Router();
  const controller = new WhatsAppController(whatsappService, contactService,messageService);

  // QR Code generation
  router.get('/qr', (req, res) => controller.generateQR(req, res));

  // File upload for contacts
  router.post('/numbers', uploadMiddleware.single('file'), (req, res) => 
    controller.uploadContacts(req, res)
  );

  // Media upload
  router.post('/media', uploadMiddleware.fields([{ name: 'media', maxCount: 1 }]), (req, res) => 
    controller.uploadMedia(req, res)
  );

  // Message and salutation setup
  router.post('/salutations', (req, res) => controller.setSalutations(req, res));

  // Start messaging
  router.post('/start', (req, res) => controller.startMessaging(req, res));

  // Clear data
  router.post('/clear', (req, res) => controller.clearData(req, res));

  // Logout
  router.post('/logout', (req, res) => controller.logout(req, res));

  // Status check
  router.get('/status', (req, res) => controller.getStatus(req, res));

  return router;
}