const express = require("express");
const router = express.Router();
const getRoutingTable = require("../services/routingService");
router.get("/", async (req, res) => {
    try {
        const routes = await getRoutingTable();
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
        const data = await getRoutingTable();
        res.json(data);
    } catch (error) {
        console.error("Failed to get routing table:", error.message);
        res.status(500).json({
            error: "Failed to retrieve routing table"
        });
    }
});



module.exports = router;
