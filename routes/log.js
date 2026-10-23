const express = require("express");
const router = express.Router();
router.get("/", (req, res) => {
    res.render("log", {
        activePage: "log"
    });
});
module.exports = router;