const express = require("express");
const router = express.Router();

router.get("/job", (req, res) => {
  res.json({
    status: "ok",
    message: "Mining job endpoint working"
  });
});

module.exports = router;
