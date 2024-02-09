const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Record = require("../models/Record");

const authenticated = require("../middlewares/authenticated");

const router = express.Router();

router.get("/loaddata/:id", authenticated, async (req, res) => {
  try {
    const { changes, breakPoints, firstValue, name } = await Record.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: res.locals.user._id,
    });
    res.status(200).json({ changes, breakPoints, firstValue, name });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

router.post("/savedata", authenticated, async (req, res) => {
  const { id, name, changes, firstValue, breakPoint } = req.body;

  try {
    if (id === null) {
      let record = await new Record({
        changes,
        userId: res.locals.user._id,
        name,
        breakPoints: breakPoint ? [breakPoint] : [],
        firstValue,
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
        { _id: new mongoose.Types.ObjectId(id), userId: res.locals.user._id },
        breakPoint !== null
          ? {
              $push: {
                changes: {
                  $each: changes,
                },
                breakPoints: breakPoint,
              },
            }
          : {
              $push: {
                changes: {
                  $each: changes,
                },
              },
            }
      );
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err });
  }
});

module.exports = router;
