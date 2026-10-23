const express = require("express");
const router = express.Router();
router.get("/", (req, res) => {
    res.render("firewall", {
        activePage: "firewall"
    });
});
module.exports = router;