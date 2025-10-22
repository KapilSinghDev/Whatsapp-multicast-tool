// middleware/checkAuth.js
import { WhatsAppService } from "../services/WhatsAppService.js";
import auth from "../creds/auth.json" with {type:"json"};
import jwt from "jsonwebtoken";

const whatsappService = new WhatsAppService();

const checkAuth = async (req, res, next) => {
  try {
    const token = req.body.token;
    console.log(token, 'token received');
    
    // 1. First check if token exists
    if (!token) {
      return res.status(401).send({
        status: 401,
        message: "No token provided",
      });
    }

    // 2. Decode the token to check expiration
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      return res.status(401).send({
        status: 401,
        message: "Invalid token format",
      });
    }

    // 3. Check if token is expired
    if (decoded.exp) {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      console.log("Current time (seconds):", currentTimeInSeconds);
      console.log("Token expiry (seconds):", decoded.exp);
      
      if (decoded.exp < currentTimeInSeconds) {
        // Use whatsappService (not this.whatsappService)
        const exit = await whatsappService.exit();
        
        if(exit){
          return res.status(401).send({
            status: 401,
            message: "Session expired ! Login Again",
          });
        }
        return res.status(401).send({
          status: 401,
          message: "Error eliminating user",
        });
      }
    }

    // 4. Finally verify the token signature
    const isAuthenticated = await whatsappService.verify(token);
    console.log("Is authenticated:", isAuthenticated);
    
    if (isAuthenticated && auth.status === true) {
      // Token is valid, proceed to next middleware/route
      next();
    } else {
      return res.status(401).send({
        status: 401,
        message: "Invalid token",
      });
    }
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(401).send({
      status: 401,
      message: "Authentication failed",
    });
  }
};

export default checkAuth;