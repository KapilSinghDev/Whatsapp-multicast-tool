import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import fs from "fs/promises";
import { ContactService } from "./ContactService.js";

const { Client, LocalAuth, MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WhatsAppService {
  constructor(rootDir, userId) {
    this.rootDir = rootDir;
    this.userId = userId;
    this.client = null;
    this.clientReady = false;
    this.isInitializing = false;
    this.contactService = new ContactService(rootDir);
  }

  // initializeClient() {
  //   // Prevent multiple initializations
  //   if (this.client || this.isInitializing) {
  //     return this.client;
  //   }

  //   this.isInitializing = true;

  //   try {
  //     this.client = new Client({
  //       authStrategy: new LocalAuth({ clientId: `user${this.userId}` }),
  //       puppeteer: {
  //         headless: true,
  //         args: [
  //           "--no-sandbox",
  //           "--disable-setuid-sandbox",
  //           "--disable-dev-shm-usage",
  //           "--disable-accelerated-2d-canvas",
  //           "--no-first-run",
  //           "--no-zygote",
  //           "--disable-gpu",
  //         ],
  //       },
  //     });

  //     this.client.on("ready", () => {
  //       console.log(`WhatsApp client for user ${this.userId} is ready!`);
  //       this.clientReady = true;
  //       this.isInitializing = false;
  //     });

  //     this.client.on("disconnected", (reason) => {
  //       console.log(
  //         `WhatsApp client for user ${this.userId} disconnected:`,
  //         reason
  //       );
  //       this.clientReady = false;
  //       this.isInitializing = false;
  //       adino;
  //       this.client = null;
  //     });

  //     this.client.on("authenticated", () => {
  //       console.log(
  //         `WhatsApp client for user ${this.userId} is authenticated!`
  //       );

  //       // Set a timeout to check if ready event fires within reasonable time
  //       setTimeout(() => {
  //         if (!this.clientReady) {
  //           console.error(
  //             `❌ Ready event did not fire within 10 seconds after authentication for user ${this.userId}!`
  //           );
  //           console.log("Attempting to manually check client state...");

  //           // Try to force ready state if client seems functional
  //           if (this.client && this.client.info) {
  //             console.log(
  //               "Client info available, manually setting ready state"
  //             );
  //             this.clientReady = true;
  //             this.isInitializing = false;
  //           }
  //         }
  //       }, 10000); // Wait 10 seconds after authentication
  //     });

  //     this.client.initialize().catch((err) => {
  //       console.error(
  //         `Failed to initialize WhatsApp client for user ${this.userId}:`,
  //         err
  //       );
  //       this.clientReady = false;
  //       this.isInitializing = false;
  //       this.client = null;
  //     });
  //   } catch (error) {
  //     console.error(
  //       `Error creating WhatsApp client for user ${this.userId}:`,
  //       error
  //     );
  //     this.clientReady = false;
  //     this.isInitializing = false;
  //     this.client = null;
  //   }

  //   return this.client;
  // }

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
          console.warn(
            `Error destroying existing client for user ${this.userId}:`,
            destroyError
          );
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
          res.status(500).send("Timeout waiting for WhatsApp events");
        }
      }, 60000);

      // Initialize a new client
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: `user${this.userId}` }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
          ],
        },
      });
      console.log("-----------------initialised a new client-----------------");
      // Set up event handlers BEFORE initializing
      this.client.on("qr", async (qr) => {
        if (qrSent) return;

        try {
          console.log(`QR Code received for user ${this.userId}`);
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
                <title>WhatsApp QR Code - User ${this.userId}</title>
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
          console.error(
            `Error generating QR code image for user ${this.userId}:`,
            err
          );
          if (!res.headersSent && !qrSent) {
            qrSent = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            res.status(500).send("Failed to generate QR code: " + err.message);
          }
        }
      });

      this.client.on("ready", () => {
        console.log(`🚀 WhatsApp client for user ${this.userId} is ready!`);
        console.log("Setting clientReady to true...");
        this.clientReady = true;
        this.isInitializing = false;
        console.log("clientReady is now:", this.clientReady);
      });

      this.client.on("authenticated", () => {
        console.log(
          `WhatsApp client for user ${this.userId} is authenticated!`
        );
      });

      this.client.on("auth_failure", (err) => {
        console.error(
          `WhatsApp authentication failed for user ${this.userId}:`,
          err
        );

        if (!res.headersSent && !qrSent) {
          qrSent = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          res.status(500).send("Authentication failed: " + err.message);
        }
      });

      this.client.on("disconnected", (reason) => {
        console.log(
          `WhatsApp client for user ${this.userId} disconnected during QR generation:`,
          reason
        );
        this.clientReady = false;
      });

      // Add error handler for client initialization errors
      this.client.on("error", (error) => {
        console.error(`WhatsApp client error for user ${this.userId}:`, error);

        if (!res.headersSent && !qrSent) {
          qrSent = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          res.status(500).send("WhatsApp client error: " + error.message);
        }
      });

      // Start the client initialization
      this.isInitializing = true;
      await this.client.initialize();
    } catch (err) {
      console.error(
        `Failed to initialize WhatsApp client for QR for user ${this.userId}:`,
        err
      );

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
        res
          .status(500)
          .send("Failed to initialize WhatsApp client: " + err.message);
      }
    }
  }

  isClientReady() {
    return this.client && this.clientReady;
  }

  async sendBulkMessages(useImage = false) {
    if (!this.isClientReady()) {
      throw new Error(
        "WhatsApp client is not ready. Please scan QR code first."
      );
    }

    const contacts = this.contactService.readContactsFromExcel();
    const unsentContacts = contacts.filter((contact) => !contact.sent);

    if (unsentContacts.length === 0) {
      return { sent: 0, failed: 0, errors: [] };
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Use ContactService's readMessageData method
    const messageData = await this.contactService.readMessageData();
    const mediaPath = await this.contactService.getLatestMediaPath();

    for (const contact of unsentContacts) {
      const number = contact.phone;
      let chatId = number.replace(/\D/g, "");

      // Add country code if missing (assuming default is +91)
      if (chatId.length <= 10) {
        chatId = "91" + chatId;
      }
      chatId = chatId + "@c.us";

      let salutation = contact.name;
      if (salutation === "NULL") {
        salutation = messageData.salutation;
      }

      const text = messageData.message || "";
      const caption = salutation + " " + text;

      try {
        const isHiddenFile = (filePath) =>
          path.basename(filePath).startsWith(".");

        if (
          !isHiddenFile(mediaPath) &&
          existsSync(mediaPath) &&
          useImage === true
        ) {
          const media = MessageMedia.fromFilePath(mediaPath);

          if (!media) {
            throw new Error(
              "No poster found to be used. Please upload a poster first."
            );
          }

          await this.client.sendMessage(chatId, media, { caption });
          console.log(`sent media message for user ${this.userId}`);
        } else {
          await this.client.sendMessage(chatId, caption);
          console.log(`sent text message for user ${this.userId}`);
        }

        contact.sent = true;
        results.sent++;
        console.log(`Message sent to ${number} for user ${this.userId}`);

        // Add delay between messages to avoid being blocked
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        results.failed++;
        results.errors.push({ number, error: err.message });
        console.error(
          `Failed to send message to ${number} for user ${this.userId}:`,
          err.message
        );
      }
    }

    console.log(
      `contacts to update for user ${this.userId} ->`,
      unsentContacts
    );
    this.contactService.updateContactStatusInExcel(unsentContacts, true);

    return results;
  }

  async logout(removeAuth = false) {
    if (!this.client) {
      console.log("attempted to logout even when no client existed");
      throw new Error("No active WhatsApp session found");
    }

    try {
      console.log("attempting a logout");
      await this.client.logout();
      console.log(
        `WhatsApp client logged out successfully for user ${this.userId}`
      );
    } catch (error) {
      console.error(`Error during logout for user ${this.userId}:`, error);
    }

    try {
      await this.client.destroy();
    } catch (error) {
      console.error(`Error destroying client for user ${this.userId}:`, error);
    }

    this.client = null;
    this.clientReady = false;
    this.isInitializing = false;

    let authRemoved = false;
    if (removeAuth === true) {
      try {
        const authFolder = path.join(
          process.cwd(),
          ".wwebjs_auth",
          `session-user${this.userId}`
        );
        if (existsSync(authFolder)) {
          await fs.rm(authFolder, { recursive: true, force: true });
          console.log(`Authentication data removed for user ${this.userId}`);
          authRemoved = true;
        }
      } catch (error) {
        console.error(
          `Failed to remove authentication data for user ${this.userId}:`,
          error
        );
      }
    }

    return { authRemoved };
  }

  getStatus() {
    console.log(`=== Status Check for user ${this.userId} ===`);
    console.log("this.clientReady:", this.clientReady);
    console.log("this.client exists ======>    :  ", !this.client);
    console.log("this.isInitializing:", this.isInitializing);

    return {
      status: this.clientReady ? "connected" : "disconnected",
      client: this.client ? "initialized" : "not_initialized",
      initializing: this.isInitializing,
    };
  }
}
