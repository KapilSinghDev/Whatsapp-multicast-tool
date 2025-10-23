// middleware/checkAuth.js
import { WhatsAppService } from "../services/WhatsAppService.js";
import auth from "../creds/auth.json" with {type:"json"};
import jwt from "jsonwebtoken";

const whatsappService = new WhatsAppService();

const checkAuth = async (req, res, next) => {
  try {
    
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    console.log(authHeader, "token received");
    
    // 1. Check if token exists
    if (!token) {
      req.isAuthenticated = false;
      req.authMessage = "No token provided";
      return next(); // CHANGED: Call next() instead of sending response
    }

    // 2. Decode the token
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      req.isAuthenticated = false;
      req.authMessage = "Invalid token format";
      return next(); // CHANGED
    }

    // 3. Check if token is expired
    if (decoded.exp) {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      console.log("Current time (seconds):", currentTimeInSeconds);
      console.log("Token expiry (seconds):", decoded.exp);
      
      if (decoded.exp < currentTimeInSeconds) {
        const exit = await whatsappService.exit();
        
        req.isAuthenticated = false;
        req.authMessage = exit ? "Session expired ! Login Again" : "Error eliminating user";
        return next(); // CHANGED
      }
    }

    // 4. Verify the token signature
    const isAuthenticated = await whatsappService.verify(token);
    console.log("Is authenticated:", isAuthenticated);
    console.log("status:", auth.status);
    
    if (isAuthenticated && auth.status === true) {
      console.log("redirecting to authenticated", auth.status);
      req.isAuthenticated = true;
      next();
    } else {
      console.log("redirecting to unauthorised");
      req.isAuthenticated = false;
      req.authMessage = "Invalid token";
      next(); // CHANGED
    }
  } catch (err) {
    console.error("Authentication error:", err);
    req.isAuthenticated = false;
    req.authMessage = "Authentication failed";
    next(); // CHANGED
  }
};

export default checkAuth;