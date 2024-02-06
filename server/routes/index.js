const express = require("express");
const path = require("path");

const router = express.Router();

const authenticated = require("../middlewares/authenticated");
const User = require("../models/User");
const Record = require("../models/Record");
const mongoose = require("mongoose");

router.get("/loadData", authenticated, (req, res) => {
  res.status(200).json(res.locals.user.plans[req.params.planType]);
});
router.post("/saveData", authenticated, async (req, res) => {
  console.log(req.body);
  const { id, changes } = req.body;

  try {
    if (id === null) {
      let record = await new Record({
        changes,
        userId: res.locals.user._id,
      }).save();
      await User.updateOne(
        { _id: res.locals.user._id },
        {
          $push: {
            records: record._id,
          },
        }
      );
      res.status(201).json({ id: record._id });
    } else {
      await Record.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        {
          $push: {
            changes: {
              $each: changes,
            },
          },
        }
      );
    }
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

module.exports = router;
