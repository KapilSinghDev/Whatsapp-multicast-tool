// DOM Elements
const loginContainer = document.getElementById("loginContainer");
const mainContainer = document.getElementById("mainContainer");
const userIdInput = document.getElementById("userIdInput");
const loginBtn = document.getElementById("loginBtn");
const userIdDisplay = document.getElementById("userIdDisplay");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const connectBtn = document.getElementById("connectBtn");
const logoutBtn = document.getElementById("logoutBtn");
const qrContainer = document.getElementById("qrContainer");
const qrCode = document.getElementById("qrCode");
const contactsFile = document.getElementById("contactsFile");
const contactsFileName = document.getElementById("contactsFileName");
const uploadContactsBtn = document.getElementById("uploadContactsBtn");
const mediaFile = document.getElementById("mediaFile");
const mediaFileName = document.getElementById("mediaFileName");
const uploadMediaBtn = document.getElementById("uploadMediaBtn");
const salutation = document.getElementById("salutation");
const message = document.getElementById("message");
const saveMessageBtn = document.getElementById("saveMessageBtn");
const startCampaignBtn = document.getElementById("startCampaignBtn");
const startImageCampaignBtn = document.getElementById("startPosterCampaignBtn");
const logs = document.getElementById("logs");
const selectContacts = document.getElementById("contacts-x");
const selectMedia = document.getElementById("media-x");
const goButton = document.getElementById("executeActions");

// Base URL for API calls
const BASE_URL = "http://localhost:3000";

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  const userId = sessionStorage.getItem("userId");
  if (userId && userId >= 1 && userId <= 10) {
    showMainContainer(userId);
    checkStatus();
    loadMessageSettings();
  } else {
    loginContainer.style.display = "block";
    mainContainer.style.display = "none";
  }

  // Set up file input listeners
  contactsFile.addEventListener("change", () => {
    contactsFileName.textContent =
      contactsFile.files[0]?.name || "No file chosen";
  });

  mediaFile.addEventListener("change", () => {
    mediaFileName.textContent = mediaFile.files[0]?.name || "No file chosen";
  });

  // Button event listeners
  loginBtn.addEventListener("click", login);
  connectBtn.addEventListener("click", connectWhatsApp);
  logoutBtn.addEventListener("click", logoutWhatsApp);
  uploadContactsBtn.addEventListener("click", uploadContacts);
  uploadMediaBtn.addEventListener("click", uploadMedia);
  saveMessageBtn.addEventListener("click", saveMessageSettings);
  startCampaignBtn.addEventListener("click", startCampaign);
  startImageCampaignBtn.addEventListener("click", startCaptionWithImage);
  selectContacts.addEventListener("click", clearAssets);
  selectMedia.addEventListener("click", clearAssets);
  goButton.addEventListener("click", deleteAction);
});

// Get user-specific API base URL
function getApiBaseUrl() {
  const userId = sessionStorage.getItem("userId");
  return `${BASE_URL}/bot/${userId}`;
}

// Login function
function login() {
  const userId = parseInt(userIdInput.value);
  if (isNaN(userId) || userId < 1 || userId > 10) {
    addLog("Please enter a valid user ID (1-10).", "error");
    return;
  }

  sessionStorage.setItem("userId", userId);
  showMainContainer(userId);
  checkStatus();
  loadMessageSettings();
}

// Show main container and update user ID display
function showMainContainer(userId) {
  loginContainer.style.display = "none";
  mainContainer.style.display = "block";
  userIdDisplay.textContent = userId;
}

// Add log entry
function addLog(message, type = "info") {
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = message;
  logs.prepend(logEntry);
}

// Check WhatsApp connection status
async function checkStatus() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/status`);
    const data = await response.json();

    if (data.status === "connected") {
      statusDot.classList.add("connected");
      statusText.textContent = "Connected";
      addLog("WhatsApp is connected and ready.", "success");
    } else {
      statusDot.classList.remove("connected");
      statusText.textContent = "Disconnected";
      addLog("WhatsApp is disconnected.", "error");
    }
  } catch (error) {
    console.error("Error checking status:", error);
    statusDot.classList.remove("connected");
    statusText.textContent = "API Error";
    addLog("Error connecting to the server.", "error");
  }
}

// Connect WhatsApp and show QR code
function connectWhatsApp() {
  addLog("Requesting QR code...", "info");
  qrContainer.style.display = "block";

  // Create iframe to show QR code
  const iframe = document.createElement("iframe");
  iframe.width = "100%";
  iframe.height = "300px";
  iframe.style.border = "none";
  iframe.src = `${getApiBaseUrl()}/qr`;

  qrCode.innerHTML = "";
  qrCode.appendChild(iframe);

  // Poll for status after showing QR
  const statusInterval = setInterval(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/status`);
      const data = await response.json();

      if (data.status === "connected") {
        clearInterval(statusInterval);
        statusDot.classList.add("connected");
        statusText.textContent = "Connected";
        qrContainer.style.display = "none";
        addLog("WhatsApp connected successfully!", "success");
      }
    } catch (error) {
      console.error("Error checking status:", error);
    }
  }, 3000);
}

// Logout from WhatsApp
async function logoutWhatsApp() {
  try {
    addLog("Logging out from WhatsApp...", "info");
    const response = await fetch(`${getApiBaseUrl()}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeAuth: true }),
    });

    const data = await response.json();

    if (data.status === 200) {
      addLog("Logged out successfully.", "success");
      statusDot.classList.remove("connected");
      statusText.textContent = "Disconnected";
      sessionStorage.removeItem("userId");
      loginContainer.style.display = "block";
      mainContainer.style.display = "none";
    } else {
      addLog(`Logout failed: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error during logout:", error);
    addLog("Error logging out.", "error");
  }
}

// Upload contacts
async function uploadContacts() {
  if (!contactsFile.files[0]) {
    addLog("Please select a CSV file first.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", contactsFile.files[0]);

  try {
    addLog("Uploading contacts...", "info");
    const response = await fetch(`${getApiBaseUrl()}/numbers`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.status === 200) {
      addLog(
        `Contacts uploaded successfully. Added ${data.newContactsAdded} new contacts.`,
        "success"
      );
      if (data.repeatedContacts > 0) {
        addLog(`${data.repeatedContacts} contacts were duplicates.`, "info");
      }
      contactsFile.value = "";
      contactsFileName.textContent = "No file chosen";
    } else {
      addLog(`Failed to upload contacts: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error uploading contacts:", error);
    addLog("Error uploading contacts.", "error");
  }
}

// Upload media
async function uploadMedia() {
  if (!mediaFile.files[0]) {
    addLog("Please select a media file first.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("media", mediaFile.files[0]);

  try {
    addLog("Uploading media...", "info");
    const response = await fetch(`${getApiBaseUrl()}/media`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.status === 200) {
      addLog("Media uploaded successfully.", "success");
      mediaFile.value = "";
      mediaFileName.textContent = "No file chosen";
    } else {
      addLog(`Failed to upload media: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error uploading media:", error);
    addLog("Error uploading media.", "error");
  }
}

// Load message settings (placeholder since no endpoint exists)
async function loadMessageSettings() {
  // Note: No endpoint to load message settings currently exists
  salutation.value = "";
  message.value = "";
}

// Save message settings
async function saveMessageSettings() {
  if (!message.value.trim()) {
    addLog("Please enter a message first.", "error");
    return;
  }

  try {
    addLog("Saving message settings...", "info");
    const response = await fetch(`${getApiBaseUrl()}/salutations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        salutation: salutation.value.trim(),
        message: message.value.trim(),
      }),
    });

    const data = await response.json();

    if (data.status === 201) {
      addLog("Message settings saved successfully.", "success");
    } else {
      addLog(`Failed to save message settings: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error saving message settings:", error);
    addLog("Error saving message settings.", "error");
  }
}

// Start text campaign
async function startCampaign() {
  try {
    addLog("Starting text campaign...", "info");
    const response = await fetch(`${getApiBaseUrl()}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ option: "start", useImage: false }),
    });

    const data = await response.json();

    if (data.status === 200) {
      addLog(
        `Campaign completed! Sent ${data.totalMessagesSent} messages successfully.`,
        "success"
      );
      if (data.totalMessagesFailed > 0) {
        addLog(`Failed to send ${data.totalMessagesFailed} messages.`, "error");
      }
    } else if (data.status === 400 && data.message.includes("not ready")) {
      addLog("WhatsApp is not connected. Please connect first.", "error");
    } else {
      addLog(`Campaign failed: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error starting campaign:", error);
    addLog("Error starting campaign.", "error");
  }
}

// Start image campaign
async function startCaptionWithImage() {
  try {
    addLog("Starting image campaign...", "info");
    const response = await fetch(`${getApiBaseUrl()}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ option: "start", useImage: true }),
    });

    const data = await response.json();

    if (data.status === 200) {
      addLog(
        `Campaign completed! Sent ${data.totalMessagesSent} messages successfully.`,
        "success"
      );
      if (data.totalMessagesFailed > 0) {
        addLog(`Failed to send ${data.totalMessagesFailed} messages.`, "error");
      }
    } else if (data.status === 400 && data.message.includes("not ready")) {
      addLog("WhatsApp is not connected. Please connect first.", "error");
    } else {
      addLog(`Campaign failed: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error starting campaign:", error);
    addLog("Error starting campaign.", "error");
  }
}

// Clear assets (contacts or media)
function clearAssets(e) {
  // No API call needed here; just toggle checkbox state
  // Actual action is triggered by deleteAction
}

// Delete selected assets
async function deleteAction() {
  const contacts = selectContacts.checked;
  const media = selectMedia.checked;

  if (!contacts && !media) {
    addLog("Please select at least one action (contacts or media).", "error");
    return;
  }

  try {
    addLog("Performing clear actions...", "info");
    const response = await fetch(`${getApiBaseUrl()}/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contacts, media }),
    });

    const data = await response.json();

    if (data.status === 200) {
      if (data.results.contactsCleared) {
        addLog("Contacts marked as unsent.", "success");
      }
      if (data.results.mediaDeleted) {
        addLog("Media files deleted.", "success");
      }
      data.results.messages.forEach((msg) => addLog(msg, "info"));
      selectContacts.checked = false;
      selectMedia.checked = false;
    } else {
      addLog(`Clear action failed: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error performing clear action:", error);
    addLog("Error performing clear action.", "error");
  }
}
