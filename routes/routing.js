const express = require("express");
const router = express.Router();
const interfaceService = require("../services/routingService");
router.get("/", async (req, res) => {
    try {
        const routes = await routingService.getRoutingTable();
        res.render("routing", {
            routes,
            activePage: "routing"
        });

    } catch (error) {
        console.error("Failed to get routing table:", error.message);
        res.status(500).json({
            error: "Failed to retrieve routing table"
        });
    }
});
router.get("/data", async (req, res) => {
    try {
        const data = await interfaceService.getRoutingTable();
        res.json(data);
    } catch (error) {
        console.error("Failed to get routing table:", error.message);
        res.status(500).json({
            error: "Failed to retrieve routing table"
        });
    }
});



module.exports = router;
