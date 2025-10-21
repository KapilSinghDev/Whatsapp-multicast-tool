const API_BASE_URL = "http://localhost:3000/bot";

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent default form submission
  const phone = document.getElementById("user-phone").value;
  const name = document.getElementById("user-name").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  console.log("Submitting login with:", { mobile: phone, name, password });

  try {
    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: phone, name, password }),
    });
    console.log(
      "Auth request sent, status:",
      response.status,
      "OK:",
      response.ok
    );

    const data = await response.json();
    console.log("Auth response:", data);

    if (data.success && data.token) {
      console.log("Storing token in localStorage:", data.token);
      localStorage.setItem("botToken", data.token);
      // Verify token immediately after storing
      await verifyToken(data.token);
    } else {
      console.error("Auth failed, response:", data);
      errorMessage.textContent =
        data.message || "Login failed. Please check your credentials.";
      errorMessage.style.display = "block";
    }
  } catch (err) {
    console.error("Login error:", err.message, err);
    errorMessage.textContent = "Network or server error. Please try again.";
    errorMessage.style.display = "block";
  }
});

// Function to verify token and handle HTML response
async function verifyToken(token) {
  console.log("Verifying token:", token);
  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    console.log(
      "Verify request sent, status:",
      response.status,
      "OK:",
      response.ok
    );

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      console.log("Response Content-Type:", contentType);
      if (contentType && contentType.includes("text/html")) {
        const html = await response.text();
        console.log("Received HTML (first 100 chars):", html.substring(0, 100));
        document.open();
        document.write(html);
        document.close();
      } else {
        const data = await response.json();
        console.error("Verify response (non-HTML):", data);
        throw new Error(
          data.message || "Verification failed: Expected HTML response"
        );
      }
    } else {
      const data = await response.json();
      console.error("Verify failed:", data);
      throw new Error(data.message || "Verification failed");
    }
  } catch (err) {
    console.error("Verification error:", err.message, err);
    localStorage.removeItem("botToken"); // Clear invalid token
    document.getElementById("error-message").textContent =
      err.message || "Verification error. Please log in again.";
    document.getElementById("error-message").style.display = "block";
  }
}

// Check for existing token on page load
window.addEventListener("load", async () => {
  const token = localStorage.getItem("botToken");
  if (token) {
    console.log("Found existing token on load:", token);
    await verifyToken(token);
  } else {
    console.log("No token found in localStorage on load");
  }
});
