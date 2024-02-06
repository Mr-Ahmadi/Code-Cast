const mongoose = require("mongoose");

const ChangeSchema = new mongoose.Schema({
  millis: {
    type: Number,
  },
  type: {
    type: Boolean,
  },
  index: {
    type: Number,
  },
  value: {
    type: String,
  },
});

const RecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
  },
  voice: {
    type: String,
  },
  breakPoints: [String],
  changes: [[ChangeSchema]],
});

const Record = mongoose.model("Project", RecordSchema, "projects");

module.exports = Record;
