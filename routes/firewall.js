const express = require("express");
const router = express.Router();

const {
    getFirewallRules,
    parseFirewallRules,
    addFirewallRule
} = require("../services/firewallService");

router.get("/", async (req, res) => {
    try {
        const rawRules = await getFirewallRules();
        const rules = parseFirewallRules(rawRules);

        res.render("firewall", {
            rules,
            activePage: "firewall"
        });
        console.log(rules);
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to load firewall rules");
    }
});

router.post("/add", async (req, res) => {
    try {
        console.log("Request body:", req.body);
        console.log("Content-Type:", req.headers["content-type"])
        await addFirewallRule({
            chain: req.body.chain,
            protocol: req.body.protocol,
            action: req.body.action,
            port: req.body.port,
            source: req.body.source,
            destination: req.body.destination
        });

        res.redirect("/firewall");
    } catch (error) {
        console.error("Failed to add firewall rule:", error.message);
        res.status(400).send("Failed to add firewall rule: " + error.message);
    }
});

module.exports = router;