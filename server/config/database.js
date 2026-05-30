const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "codevideo",
  process.env.DB_USER || "codevideo",
  process.env.DB_PASSWORD || "codevideo_pass",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: false,
  }
);

module.exports = sequelize;
