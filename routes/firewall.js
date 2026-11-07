const express = require("express");

const {
    readAssignments
} = require("../services/interfaceService");

const {
    getFirewallRules,
    addFirewallRule,
    updateFirewallRule,
    deleteFirewallRule,
    toggleFirewallRule,
    reorderFirewallRules
} = require("../services/firewallService");

const router = express.Router();

// Firewall Rules page
router.get("/", async (req, res, next) => {
    try {
        const data = await readAssignments();

        const rules = await getFirewallRules();

        res.render("firewall", {
            activePage: "firewall",
            interfaces: data.interfaces,
            rules
        });

    } catch (err) {
        next(err);
    }
});

// Get rules
router.get("/rules", async (req, res, next) => {
    try {
        const interfaceId = req.query.interface || null;

        const rules = await getFirewallRules(interfaceId);

        res.json({ rules });

    } catch (err) {
        next(err);
    }
});

// Add rule
router.post("/rules", async (req, res) => {
    try {
        const rule = await addFirewallRule(req.body);

        res.status(201).json({
            message: "Rule created successfully",
            rule
        });

    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// Update rule
router.put("/rules/:id", async (req, res) => {
    try {
        const rule = await updateFirewallRule(
            req.params.id,
            req.body
        );

        res.json({
            message: "Rule updated successfully",
            rule
        });

    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// Delete rule
router.delete("/rules/:id", async (req, res) => {
    try {
        await deleteFirewallRule(req.params.id);

        res.json({
            message: "Rule deleted successfully"
        });

    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// Toggle rule
router.patch("/rules/:id/toggle", async (req, res) => {
    try {
        const rule = await toggleFirewallRule(
            req.params.id
        );

        res.json({
            message: "Rule status updated",
            rule
        });

    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// Reorder rules
router.put("/rules/order", async (req, res) => {
    try {
        const rules = await reorderFirewallRules(
            req.body.ids
        );

        res.json({
            message: "Rule order updated",
            rules
        });

    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

module.exports = router;