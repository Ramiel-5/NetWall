const express = require("express");
const router = express.Router();

const { getRoutingTable } = require("../services/routeService");
const { getInterfaces } = require("../services/interfaceService");

// Routing Table page
router.get("/", async (req, res) => {
    try {
        const interfaces = await getInterfaces();

        const interfaceList = Array.isArray(interfaces)
            ? interfaces
            : Object.entries(interfaces || {}).map(([name]) => ({
                id: name,
                name
            }));

        res.render("routes", {
            interfaces: interfaceList,
            activePage: "routes"
        });

    } catch (error) {
        console.error("Routing Page Error:", error);
        res.status(500).send("Unable to load routing page.");
    }
});

// Get routing table data
router.get("/data", async (req, res) => {
    try {
        const routes = await getRoutingTable();

        res.json({
            success: true,
            routes
        });

    } catch (error) {
        console.error("Routing Table Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to retrieve routing table."
        });
    }
});

module.exports = router;