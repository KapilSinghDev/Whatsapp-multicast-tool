import express from "express";

export default function whatsappRoutes(uploadMiddleware, userDataMap) {
  const router = express.Router();

  // QR Code generation
  router.get("/qr", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.generateQR(req, res);
  });

  // File upload for contacts
  router.post("/numbers", uploadMiddleware.single("file"), (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.uploadContacts(req, res);
  });

  // Media upload
  router.post(
    "/media",
    uploadMiddleware.fields([{ name: "media", maxCount: 1 }]),
    (req, res) => {
      const controller = userDataMap.get(req.userId).controller;
      controller.uploadMedia(req, res);
    }
  );

  // Message and salutation setup
  router.post("/salutations", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.setSalutations(req, res);
  });

  // Start messaging
  router.post("/start", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.startMessaging(req, res);
  });

  // Clear data
  router.post("/clear", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.clearData(req, res);
  });

  // Logout
  router.post("/logout", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.logout(req, res);
  });

  // Status check
  router.get("/status", (req, res) => {
    const controller = userDataMap.get(req.userId).controller;
    controller.getStatus(req, res);
  });

  return router;
}
