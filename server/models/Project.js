const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Workspace = sequelize.define(
  "Workspace",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: User, key: "id" } },
    name: { type: DataTypes.STRING, allowNull: false },
    files: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { tableName: "workspaces", timestamps: false }
);

Workspace.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Workspace, { foreignKey: "userId" });

module.exports = Workspace;
