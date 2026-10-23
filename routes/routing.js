const express = require("express");
const router = express.Router();
const interfaceService = require("../services/interfaceService");

router.get("/", async (req, res) => {
    try {
        const routes = await interfaceService.getRoutingTable();
        res.json(routes);
    } catch (error) {
        console.error("Failed to get routing table:", error.message);

        res.status(500).json({
            error: "Failed to retrieve routing table"
        });
    }
});

module.exports = router;