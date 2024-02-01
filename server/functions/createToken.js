const createToken = (id) => {
  return jwt.sign({ id }, "secret", {
    expiresIn: 3 * 24 * 60 * 60,
  });
};

module.exports = sendEmail;
