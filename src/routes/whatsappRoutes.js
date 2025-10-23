// src/routes/whatsappRoutes.js
import express from "express";
import { WhatsAppController } from "../controllers/WhatsAppController.js";
import checkAuth from "../middleware/authenticate.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default function whatsappRoutes(
  whatsappService,
  contactService,
  messageService,
  uploadMiddleware
) {
  const router = express.Router();
  const controller = new WhatsAppController(
    whatsappService,
    contactService,
    messageService
  );

  // QR Code generation
  router.get("/qr", (req, res) => controller.generateQR(req, res));

  // File upload for contacts
  router.post("/numbers", uploadMiddleware.single("file"), (req, res) =>
    controller.uploadContacts(req, res)
  );

  // Media upload
  router.post(
    "/media",
    uploadMiddleware.fields([{ name: "media", maxCount: 1 }]),
    (req, res) => controller.uploadMedia(req, res)
  );

  // Message and salutation setup
  router.post("/salutations", (req, res) =>
    controller.setSalutations(req, res)
  );

  // Start messaging
  router.post("/start", (req, res) => controller.startMessaging(req, res));

  // Clear data
  router.post("/clear", (req, res) => controller.clearData(req, res));

  // delete contacts
  router.delete("/delete", (req, res) => controller.deleteContacts(req, res));

  // Logout
  router.post("/logout", (req, res) => controller.logout(req, res));

  // Status check
  router.get("/status", (req, res) => controller.getStatus(req, res));

  // authenitcation
  router.post("/auth", (req, res) => controller.login(req, res));

  // verify
  router.post("/verify", checkAuth, (req, res) => {
    console.log("verifu route", req.isAuthenticated);
    if (req.isAuthenticated) {
      // Authenticated - send dashboard
      res.sendFile(path.join(__dirname, "..", "private", "index.html"));
    } else {
      if (req.authMessage === "No token provided") {
        return res.redirect("/");
      }
      console.log("redirecting to unauthenticated route");
      // Not authenticated - send login page
      res.sendFile(path.join(__dirname, "..", "public", "unavailable.html"));
    }
  });

  // /auth/logout
  router.post("/auth/logout", checkAuth, (req, res) => {
    if (!req.isAuthenticated) {
      res.sendFile(path.join(__dirname, "..", "public", "unavailable.html"));
    } else {
      controller.userLogout(req, res);
    }
  });

  return router;
}
