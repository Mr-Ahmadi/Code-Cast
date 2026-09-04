const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Pull the JWT off the request. Cookies work when the client is served from
 * the same origin as the API; a bearer header is what a client pointed at a
 * custom endpoint uses, since it cannot read a cookie set for another origin.
 */
function extractToken(req) {
  if (req.cookies && req.cookies.jwt) return req.cookies.jwt;

  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();

  return null;
}

function verify(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

module.exports = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  let decoded;
  try {
    decoded = await verify(token, process.env.JWT_SECRET || "secret");
  } catch {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // The user lookup hits the database, which can be down. Reporting that as
  // 503 keeps a transient outage from looking like a rejected credential —
  // and keeps the thrown error from taking the process down with it.
  try {
    const user = await User.findByPk(decoded.id);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.locals.user = user;
    next();
  } catch (err) {
    console.error("Auth lookup failed:", err.message);
    res.status(503).json({ message: "Database unavailable" });
  }
};

module.exports.extractToken = extractToken;
