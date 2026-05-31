const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const Workspace = require("./Project");

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
      references: { model: User, key: "id" },
    },
    workspaceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Workspace, key: "id" },
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
    files: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    fileTimeline: {
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
Record.belongsTo(Workspace, { foreignKey: "workspaceId" });
Workspace.hasMany(Record, { foreignKey: "workspaceId" });

module.exports = Record;
