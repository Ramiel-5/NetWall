const express = require("express");

const {
    getInterfaces,
    readAssignments,
    saveAssignments
} = require("../services/interfaceService");

const router = express.Router();

// Interface Assignments page
router.get("/", (req, res) => {
    res.render("assignment", {
        activePage: "interfaces"
    });
});

// Get available NICs
router.get("/ports", (req, res) => {
    try {
        const interfaces = getInterfaces();

        res.json({ interfaces });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// Get assignments
router.get("/assignments", async (req, res, next) => {
    try {
        const data = await readAssignments();

        res.json({
            assignments: data.interfaces
        });

    } catch (err) {
        next(err);
    }
});

// Save assignments
router.put("/assignments", async (req, res, next) => {
    try {
        // Receive data from frontend
        const assignments = req.body?.interfaces;

        if (!Array.isArray(assignments)) {
            return res.status(400).json({
                error: "Invalid assignments data"
            });
        }

        const availableNics = Object.keys(getInterfaces());

        // Check maximum number of logical interfaces
        if (assignments.length > availableNics.length) {
            return res.status(400).json({
                error: "Maximum number of logical interfaces reached"
            });
        }

        const normalized = [];

        for (const item of assignments) {
            if (
                !item ||
                typeof item.id !== "string" ||
                typeof item.name !== "string" ||
                typeof item.nic !== "string"
            ) {
                return res.status(400).json({
                    error: "Invalid interface properties"
                });
            }

            const id = item.id.trim();
            const name = item.name.trim();
            const nic = item.nic.trim();

            if (!/^(WAN|LAN|OPT[1-9]\d*)$/.test(id)) {
                return res.status(400).json({
                    error: `Invalid interface ID: ${id}`
                });
            }

            if (!name) {
                return res.status(400).json({
                    error: "Interface name cannot be empty"
                });
            }

            normalized.push({
                id,
                name,
                nic
            });
        }

        // Check duplicate IDs
        const ids = normalized.map(item => item.id);

        if (new Set(ids).size !== ids.length) {
            return res.status(400).json({
                error: "Duplicate interface IDs"
            });
        }

        // WAN must exist
        if (!ids.includes("WAN")) {
            return res.status(400).json({
                error: "WAN interface cannot be deleted"
            });
        }

        // Check duplicate names
        const names = normalized.map(
            item => item.name.toLowerCase()
        );

        if (new Set(names).size !== names.length) {
            return res.status(400).json({
                error: "Duplicate interface names"
            });
        }

        // Check NIC availability
        const selectedNics = normalized
            .map(item => item.nic)
            .filter(nic => nic !== "");

        for (const nic of selectedNics) {
            if (!availableNics.includes(nic)) {
                return res.status(400).json({
                    error: `NIC ${nic} is unavailable`
                });
            }
        }

        // Check duplicate NIC assignments
        if (new Set(selectedNics).size !== selectedNics.length) {
            return res.status(400).json({
                error: "A NIC cannot be assigned to multiple interfaces"
            });
        }

        // Save configuration
        await saveAssignments(normalized);

        res.json({
            message: "Assignments saved successfully"
        });

    } catch (err) {
        next(err);
    }
});

// Open Interface Settings
router.get("/settings/:id", async (req, res, next) => {
    try {
        const data = await readAssignments();

        const interfaceItem = data.interfaces.find(
            item => item.id === req.params.id
        );

        if (!interfaceItem) {
            return res.status(404).send("Interface not found");
        }

        res.render("interface-settings", {
            activePage: "interfaces",
            interfaceItem
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;