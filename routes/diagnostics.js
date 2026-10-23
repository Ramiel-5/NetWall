const express = require("express");
const router = express.Router();
router.get("/", (req, res) => {
    res.render("diagnostics", {
        activePage: "diagnostics"
    });
});
module.exports = router;