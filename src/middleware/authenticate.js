// middleware/checkAuth.js
import { WhatsAppService } from "../services/WhatsAppService.js";
import auth from "../creds/auth.json" with {type:"json"};

const whatsappService = new WhatsAppService();

const checkAuth = async (req, res, next) => {
  const token = req.body.token ;
  try {
    // Extract token from request body, headers, or query params
    if (!token) {
      return res.status(401).send({
        status: 401,
        message: "No token provided",
      });
    }

    // Verify the token
    const isAuthenticated = await whatsappService.verify(token);
    console.log(isAuthenticated)
    if (isAuthenticated && auth.status === true) {
      // Token is valid, proceed to next middleware/route
      next();
    } else {
      return res.status(401).send({
        status: 401,
        message: "Invalid or expired token",
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
