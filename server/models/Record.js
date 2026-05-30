const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Record = sequelize.define(
  "Record",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    firstValue: {
      type: DataTypes.TEXT,
    },
    voice: {
      type: DataTypes.TEXT,
    },
    breakPoints: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    changes: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    executions: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
  },
  {
    tableName: "projects",
    timestamps: false,
  }
);

User.hasMany(Record, { foreignKey: "userId" });
Record.belongsTo(User, { foreignKey: "userId" });

module.exports = Record;
