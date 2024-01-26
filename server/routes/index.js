const express = require("express");
const path = require("path");

const router = express.Router();

// const authenticated = require('../middlewares/authenticated')

router.get("/loadData", (req, res) => {
  res.status(200).json(res.locals.user.plans[req.params.planType]);
});
router.post("/saveData", (req, res) => {
  const data = eval(req.body);
  console.log(data[0]);
});

module.exports = router;
