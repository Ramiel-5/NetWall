const express = require("express");
const router = express.Router();

const firewallService = require("../services/firewallService");
const { readAssignments } = require("../services/interfaceService");
const { applyFirewallRules } = require("../services/firewallApplyService");

function sendError(res, error) {
    console.error("Firewall error:", error);
    const status = /not found/i.test(error.message)
        ? 404
        : error.code === "FIREWALL_APPLY_FAILED" ? 500 : 400;
    res.status(status).json({ success: false, error: error.message || "Firewall operation failed" });
}

router.get("/", async (req, res) => {
    try {
        const assignments = await readAssignments();
        res.render("firewall", {
            activePage: "firewall",
            interfaces: assignments.interfaces.filter(item => item.nic)
        });
    } catch (error) {
        console.error("Unable to load firewall page:", error);
        res.status(500).send("Unable to load firewall page");
    }
});

router.get("/data", async (req, res) => {
    try {
        const rules = await firewallService.getFirewallRules();
        res.json({ success: true, rules });
    } catch (error) {
        sendError(res, error);
    }
});

router.post("/", async (req, res) => {
    try {
        const rule = await firewallService.runFirewallTransaction(
            () => firewallService.addFirewallRule(req.body)
        );
        res.status(201).json({ success: true, message: "Firewall rule added and applied", rule });
    } catch (error) {
        sendError(res, error);
    }
});

// Keep this route before /:id so "reorder" is not treated as a rule ID.
router.put("/reorder", async (req, res) => {
    try {
        const rules = await firewallService.runFirewallTransaction(
            () => firewallService.reorderFirewallRules(req.body.ids)
        );
        res.json({ success: true, message: "Firewall rule order updated", rules });
    } catch (error) {
        sendError(res, error);
    }
});

router.put("/:id", async (req, res) => {
    try {
        const rule = await firewallService.runFirewallTransaction(
            () => firewallService.updateFirewallRule(req.params.id, req.body)
        );
        res.json({ success: true, message: "Firewall rule updated and applied", rule });
    } catch (error) {
        sendError(res, error);
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await firewallService.runFirewallTransaction(
            () => firewallService.deleteFirewallRule(req.params.id)
        );
        res.json({ success: true, message: "Firewall rule deleted and applied" });
    } catch (error) {
        sendError(res, error);
    }
});

router.patch("/:id/toggle", async (req, res) => {
    try {
        const rule = await firewallService.runFirewallTransaction(
            () => firewallService.toggleFirewallRule(req.params.id)
        );
        res.json({ success: true, message: "Firewall rule status updated and applied", rule });
    } catch (error) {
        sendError(res, error);
    }
});

// Manual re-apply, useful after interface changes or external firewall edits.
router.post("/apply", async (req, res) => {
    try {
        const result = await applyFirewallRules();
        res.json({ success: true, message: result.message || "Firewall rules applied" });
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
