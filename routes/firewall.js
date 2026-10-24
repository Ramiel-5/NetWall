const express = require("express");
const router = express.Router();
const getFirewallRules = require("../services/firewallService");
router.get("/", async (req, res) => {
    const rules = await getFirewallRules();
    res.render("firewall", {
        rules,
        activePage: "firewall"
    });
    console.log(rules);
});
module.exports = router;