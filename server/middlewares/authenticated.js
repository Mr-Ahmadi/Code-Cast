const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = (req, res, next) => {
  const token = req.cookies.jwt;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || "secret", async (err, decodedToken) => {
      if (err) {
        res.status(401).json({ message: "Unauthorized" });
      } else {
        const user = await User.findByPk(decodedToken.id);
        if (user) {
          res.locals.user = user;
          next();
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      }
    });
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};
