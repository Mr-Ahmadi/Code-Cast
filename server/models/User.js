const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "users",
    timestamps: false,
  }
);

User.login = async function ({ email, password }) {
  const user = await this.findOne({ where: { email } });
  if (user) {
    if (await bcrypt.compare(password, user.password)) {
      return user;
    } else {
      throw Error("Incurrect email/password");
    }
  } else {
    throw Error("Incurrect email/password");
  }
};

module.exports = User;
