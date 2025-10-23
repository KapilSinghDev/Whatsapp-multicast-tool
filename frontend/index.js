console.log("🚀 index.js loaded!");

const API_BASE_URL = "http://localhost:3000/bot";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, attaching event listener");

  const form = document.getElementById("login-form");

  if (!form) {
    alert("Form not found!");
    console.error("Login form not found!");
    return;
  }

  console.log("✅ Form found:", form);

  // Remove default form action to prevent page refresh
  form.setAttribute("onsubmit", "return false;");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("🎯 SUBMIT EVENT TRIGGERED!");

    const phone = document.getElementById("user-phone").value;
    const name = document.getElementById("user-name").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");

    console.log("📝 Form values:", { mobile: phone, name, password });

    // Hide previous errors
    if (errorMessage) {
      errorMessage.style.display = "none";
    }

    try {
      console.log("📡 Sending auth request to:", `${API_BASE_URL}/auth`);

      const response = await fetch(`${API_BASE_URL}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: phone, name, password }),
      });

      console.log("📥 Response status:", response.status);

      const data = await response.json();
      console.log("📦 Full Auth response:", JSON.stringify(data, null, 2));

      // YOUR API RETURNS: { status: 200, message: "user valid", token: "..." }
      // Check for token directly (not data.success)
      if (response.ok && data.token) {
        console.log("✅ Login successful! Token:", data.token);
        console.log("📦 Token type:", typeof data.token);
        console.log("📦 Token length:", data.token.length);

        // Test if localStorage is available
        console.log("🧪 Testing localStorage availability...");
        try {
          localStorage.setItem("test", "test");
          const testValue = localStorage.getItem("test");
          console.log("🧪 localStorage test result:", testValue);
          localStorage.removeItem("test");
          console.log("✅ localStorage is working!");
        } catch (storageError) {
          console.error("❌ localStorage is NOT available:", storageError);
          alert("❌ localStorage is blocked! Check browser settings.");
          return;
        }

        // Store token
        console.log("💾 About to store token...");
        localStorage.setItem("botToken", data.token);
        console.log("💾 Token stored, now retrieving...");

        // Verify it was stored IMMEDIATELY
        const storedToken = localStorage.getItem("botToken");
        console.log("✅ Retrieved token:", storedToken);
        console.log("✅ Token match:", storedToken === data.token);

        if (!storedToken) {
          alert("❌ TOKEN NOT SAVED! Check console");
          console.error("❌ Token was not saved to localStorage!");
          return;
        }

        alert(
          "✅ Token saved successfully: " + storedToken.substring(0, 20) + "..."
        );

        // Small delay before verifying to ensure storage completes
        setTimeout(async () => {
          console.log("🔍 Starting verification...");
          const tokenBeforeVerify = localStorage.getItem("botToken");
          console.log("🔍 Token before verify:", tokenBeforeVerify);

          await verifyToken(data.token);

          const tokenAfterVerify = localStorage.getItem("botToken");
          console.log("🔍 Token after verify:", tokenAfterVerify);
        }, 100);
      } else {
        alert("❌ AUTH FAILED - " + (data.message || "Unknown error"));
        console.error("❌ Auth failed:", data);

        if (errorMessage) {
          errorMessage.textContent =
            data.message || "Login failed. Please check your credentials.";
          errorMessage.style.display = "block";
        }
      }
    } catch (err) {
      alert("❌ ERROR: " + err.message);
      console.error("❌ Login error:", err);

      if (errorMessage) {
        errorMessage.textContent = "Network or server error: " + err.message;
        errorMessage.style.display = "block";
      }
    }
  });

  console.log("✅ Event listener attached successfully");
});

// Function to verify token
async function verifyToken(token) {
  console.log("🔍 Verifying token:", token);
  console.log(
    "🔍 Token in localStorage before API call:",
    localStorage.getItem("botToken")
  );

  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("📥 Verify response status:", response.status);
    console.log(
      "🔍 Token in localStorage after API call:",
      localStorage.getItem("botToken")
    );

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      console.log("📄 Response Content-Type:", contentType);

      if (contentType && contentType.includes("text/html")) {
        const html = await response.text();
        console.log("✅ Received HTML, length:", html.length);
        console.log(
          "🔍 Token BEFORE document.write:",
          localStorage.getItem("botToken")
        );

        // Replace page with new HTML
        document.open();
        document.write(html);
        document.close();

        console.log(
          "🔍 Token AFTER document.write:",
          localStorage.getItem("botToken")
        );
      } else {
        const data = await response.json();
        console.log("📦 Verify JSON response:", data);

        // Check if verification succeeded
        if (response.status === 200) {
          console.log("✅ Verification successful!");
          alert("✅ Logged in successfully!");
        } else {
          console.log("verification failed");
          localStorage.removeItem("botToken"); // Replace "accessToken" with your actual token key
          throw new Error(data.message || "Verification failed");
        }
      }
    } else {
      const data = await response.json();
      console.error("❌ Verify failed:", data);
      throw new Error(data.message || "Verification failed");
    }
  } catch (err) {
    console.error("❌ Verification error:", err);

    // DON'T remove token on error during testing
    // localStorage.removeItem("botToken");
    console.log("⚠️ Not removing token for debugging purposes");

    const errorEl = document.getElementById("error-message");
    if (errorEl) {
      errorEl.textContent =
        err.message || "Verification error. Please log in again.";
      errorEl.style.display = "block";
    }
  }
}

// Check for existing token on page load
window.addEventListener("load", async () => {
  console.log("🔄 Page load event triggered");
  const token = localStorage.getItem("botToken");
  console.log("🔄 Token check on load...");
  console.log("💾 Token in localStorage:", token || "null");

  if (token) {
    console.log("✅ Found existing token, auto-verifying...");
    await verifyToken(token);
  } else {
    console.log("ℹ️ No token found, showing login form");
  }
});
