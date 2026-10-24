const express = require("express");
const router = express.Router();

const {
    getFirewallRules,
    parseFirewallRules,
    addFirewallRule,
    deleteFirewallRule
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
router.post("/delete", async (req, res) => {
    try {
        const { id } = req.body;

        if (
            typeof id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
        ) {
            return res.status(400).send("Invalid rule ID");
        }

        await deleteFirewallRule(id);

        res.redirect("/firewall");
    } catch (error) {
        console.error("Failed to delete firewall rule:", error.message);
        res.status(400).send("Failed to delete firewall rule");
    }
});

module.exports = router;