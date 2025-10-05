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
import { WhatsAppController } from "./src/controllers/WhatsAppController.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Prevent multiple signal listeners (fixes PM2 memory leak warnings)
process.setMaxListeners(20);
process.removeAllListeners("SIGINT");
process.removeAllListeners("SIGTERM");
process.removeAllListeners("SIGHUP");
process.removeAllListeners("exit");

const MAX_USERS = 10;
const userData = new Map();

async function initializeUsers() {
  const dataDir = path.join(__dirname, "data");
  await ensureDirectoryExists(dataDir);

  for (let i = 1; i <= MAX_USERS; i++) {
    const userId = i;
    const userDir = path.join(dataDir, `user${userId}`);
    await ensureDirectoryExists(userDir);
    await ensureDirectoryExists(path.join(userDir, "message"));

    // Initialize message file for this user
    await initializeMessageFile(userDir);

    const contactService = new ContactService(userDir);
    await contactService.initializeContactsFile();

    const whatsappService = new WhatsAppService(userDir, userId);

    const controller = new WhatsAppController(whatsappService, contactService);

    userData.set(userId, { whatsappService, contactService, controller });
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes with userId
app.use(
  "/bot/:userId",
  (req, res, next) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId) || userId < 1 || userId > MAX_USERS) {
      return res.status(400).json({ error: "Invalid userId (1-10)" });
    }
    req.userId = userId;
    next();
  },
  whatsappRoutes(createUploadMiddleware(), userData)
);

// Root route (aggregate status for all users)
app.get("/", (req, res) => {
  try {
    const statuses = {};
    for (let i = 1; i <= MAX_USERS; i++) {
      const { whatsappService } = userData.get(i);
      const status = whatsappService.getStatus();
      statuses[`user${i}`] = {
        connected: status.status === "connected",
        clientInitialized: status.client === "initialized",
      };
    }
    res.status(200).json({
      message: "Multi-user WhatsApp Bot Server is running.",
      statuses,
      pid: process.pid,
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Error checking statuses:", error);
    res.status(500).json({
      error: "Failed to check WhatsApp statuses",
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

// Graceful shutdown handlers
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    app.set("trust proxy", false);

    // Close all WhatsApp clients
    for (const user of userData.values()) {
      if (user.whatsappService && user.whatsappService.client) {
        console.log(
          `Destroying WhatsApp client for user ${user.whatsappService.userId}...`
        );
        await user.whatsappService.client.destroy();
      }
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
    await initializeUsers();

    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`PID: ${process.pid}`);
      console.log(
        `Visit http://localhost:${port}/bot/1/qr for user 1 QR code (example)`
      );
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
