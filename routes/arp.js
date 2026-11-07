const express = require("express");
const router = express.Router();

const { getArpTable } = require("../services/arpService");

// ARP page
router.get("/", (req, res) => {
    res.render("arp", {
        activePage: "arp"
    });
});

// Get dynamic ARP entries
router.get("/data", async (req, res) => {
    try {
        const entries = await getArpTable();

        res.json({
            success: true,
            entries
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;