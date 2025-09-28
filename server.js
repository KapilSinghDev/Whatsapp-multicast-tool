// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  ensureDirectoryExists,
  initializeMessageFile,
} from "./src/utils/fileUtils.js";
import { createUploadMiddleware } from "./src/middleware/upload.js";
import whatsappRoutes from "./src/routes/whatsappRoutes.js";
import { WhatsAppService } from "./src/services/WhatsAppService.js";
import { ContactService } from "./src/services/ContactService.js";
import { MessageService } from "./src/utils/messageUtils.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // Fixed: was using undefined 'env'

// Prevent multiple signal listeners (fixes PM2 memory leak warnings)
process.setMaxListeners(20);
process.removeAllListeners("SIGINT");
process.removeAllListeners("SIGTERM");
process.removeAllListeners("SIGHUP");
process.removeAllListeners("exit");

// Initialize services
const whatsappService = new WhatsAppService();
const contactService = new ContactService(__dirname);
const messageService = new MessageService(); // Fixed: missing semicolon

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(
  "/bot",
  whatsappRoutes(
    whatsappService,
    contactService,
    messageService,
    createUploadMiddleware()
  )
);

// Root route
app.get("/", (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.status(200).json({
      connected: status.status === "connected",
      clientInitialized: status.client === "initialized",
      message:
        "WhatsApp Bot Server is running. Visit /bot/qr to generate QR code.",
      pid: process.pid, // Helpful for PM2 debugging
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Error checking status:", error);
    res.status(500).json({
      connected: false,
      error: "Failed to check WhatsApp status",
    });
  }
});

// Health check endpoint for PM2
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    status: 500,
    message: "Internal server error",
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Graceful shutdown handlers (use 'once' to prevent multiple listeners)
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    app.set("trust proxy", false);

    // Close WhatsApp client
    if (whatsappService && whatsappService.client) {
      console.log("Destroying WhatsApp client...");
      await whatsappService.client.destroy();
    }

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
(async () => {
  try {
    const CONTACTS_FILE = path.join(__dirname, "contacts.xlsx");

    // Initialize directory and file structure
    await ensureDirectoryExists(path.dirname(CONTACTS_FILE));
    await initializeMessageFile(__dirname);

    // Create contacts file if it doesn't exist
    await contactService.initializeContactsFile();

    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`PID: ${process.pid}`);
      console.log(`Visit http://localhost:${port}/bot/qr to generate QR code`);
    });

    // Handle server errors
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error("Server error:", error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
})();
