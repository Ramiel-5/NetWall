const express = require("express");
const router = express.Router();

const {
    getFirewallRules,
    parseFirewallRules
} = require("../services/firewallService");

router.get("/", async (req, res) => {
    try {
        const rawRules = await getFirewallRules();
        const rules = parseFirewallRules(rawRules);

        res.render("firewall", { rules });
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to load firewall rules");
    }
});

module.exports = router;