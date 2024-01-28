/*
User => 1.Name     => (String)
        2.Email    => (String - lowercase)
        3.Verified => (Boolean)
        4.Password => (bcrypt)
        5.Record   => 1.Name
                      2.Voice                       
                      3.Break-Points
                      4.Changes       => 1.millis   => (int)
                                         2.type     => (1 or 0)
                                         3.index    => (int)
                                         4.value    => (String)
========================================================================================
==>> Needd Schema: ChangeSchema, WorkSchema, ReminderSchema, ExpenseSchema, UserSchema
*/
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ChangeSchema = new mongoose.Schema({
  millis: {
    type: String,
  },
  type: {
    type: Boolean,
  },
  index: {
    type: Boolean,
  },
  value: {
    type: Boolean,
  },
});

const RecordSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  voice: {
    type: String,
  },
  breakPoints: [String],
  changes: [ChangeSchema],
});

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
  },
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"],
  },
  verified: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  records: RecordSchema,
});

UserSchema.statics.login = async function ({ email, password }) {
  const user = await this.findOne({ email });
  if (user) {
    if (await bcrypt.compare(password, user.password)) {
      return user;
    } else {
      console.log(password);
      console.log(user.password);
      throw Error("Incurrect email/password");
    }
  } else {
    throw Error("Incurrect email/password");
  }
};

const User = mongoose.model("User", UserSchema, "users");

module.exports = User;
