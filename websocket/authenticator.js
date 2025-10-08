const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class WebSocketAuthenticator {
  constructor(options = {}) {
    this.secretKey = options.secretKey || crypto.randomBytes(64).toString('hex');
    this.tokenExpiration = options.tokenExpiration || '1h';
  }

  generateToken(userId) {
    return jwt.sign(
      { 
        userId, 
        type: 'websocket_access',
        iat: Date.now()
      }, 
      this.secretKey, 
      { expiresIn: this.tokenExpiration }
    );
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secretKey);
      
      // Additional token validation
      if (decoded.type !== 'websocket_access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Middleware for WebSocket connection authentication
  authenticateConnection(ws, req) {
    const token = this.extractToken(req);
    
    if (!token) {
      ws.close(1008, 'Authentication required');
      return false;
    }

    const decoded = this.verifyToken(token);
    
    if (!decoded) {
      ws.close(1008, 'Invalid token');
      return false;
    }

    // Attach user info to WebSocket
    ws.userId = decoded.userId;
    return true;
  }

  extractToken(req) {
    // Extract token from query parameters or headers
    return req.url.split('?token=')[1] || 
           req.headers['x-websocket-token'];
  }
}

module.exports = WebSocketAuthenticator;
