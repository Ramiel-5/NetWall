const express = require("express");
const router = express.Router();
const interfaceService = require("../services/interfaceService");
router.get("/", async (req, res) => {
    try {
        const interfaces = await interfaceService.getInterfaceStatuses();

        res.render("interfaces", {
            interfaces,
            activePage: "interfaces"
        });
    } catch (error) {
        console.error(error.message);

        res.status(500).send("Failed to load network interfaces");
    }
});

router.get("/statuses", async (req, res) => {
    try {
        const statuses = await interfaceService.getInterfaceStatuses();
        res.json(statuses);
    } catch (error) {
        console.error("Failed to get interface statuses:", error.message);

        res.status(500).json({
            error: "Failed to retrieve interface statuses"
        });
    }
});
router.get("/:name", async (req, res) => {
    try {
        const result = await interfaceService.getInterfaceByName(
            req.params.name
        );

        if (!result) {
            return res.status(404).json({
                error: "Interface not found"
            });
        }

        res.json(result);
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to retrieve interface"
        });
    }
});
router.post("/", (req, res) => {
    const { name, ip } = req.body;

    if (!name || !ip) {
        return res.status(400).json({
            error: "Name and IP are required"
        });
    }

    res.status(201).json({
        message: "Interface received",
        name,
        ip
    });
});

module.exports = router;