const express = require("express");
const net = require("net");

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
        const assignments = req.body?.interfaces;

        if (!Array.isArray(assignments)) {
            return res.status(400).json({
                error: "Invalid assignments data"
            });
        }

        const availableNics = Object.keys(getInterfaces());

        if (assignments.length > availableNics.length) {
            return res.status(400).json({
                error: "Maximum number of logical interfaces reached"
            });
        }

        // Preserve settings when saving assignments.
        const previousConfig = await readAssignments();

        const previousById = new Map(
            previousConfig.interfaces.map(item => [item.id, item])
        );

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

            const previous = previousById.get(id) || {};

            normalized.push({
                ...previous,
                id,
                name,
                nic
            });
        }

        const ids = normalized.map(item => item.id);

        if (new Set(ids).size !== ids.length) {
            return res.status(400).json({
                error: "Duplicate interface IDs"
            });
        }

        if (!ids.includes("WAN")) {
            return res.status(400).json({
                error: "WAN interface cannot be deleted"
            });
        }

        const names = normalized.map(
            item => item.name.toLowerCase()
        );

        if (new Set(names).size !== names.length) {
            return res.status(400).json({
                error: "Duplicate interface names"
            });
        }

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

        if (new Set(selectedNics).size !== selectedNics.length) {
            return res.status(400).json({
                error: "A NIC cannot be assigned to multiple interfaces"
            });
        }

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

// Save Interface Settings
router.put("/settings/:id", async (req, res, next) => {
    try {
        const data = await readAssignments();

        const interfaceItem = data.interfaces.find(
            item => item.id === req.params.id
        );

        if (!interfaceItem) {
            return res.status(404).json({
                error: "Interface not found"
            });
        }

        const body = req.body || {};

        const allowedIpv4Types = [
            "none",
            "dhcp",
            "static"
        ];

        const allowedSpeedDuplex = [
            "auto",
            "10-half",
            "10-full",
            "100-half",
            "100-full",
            "1000-full"
        ];

        const name = typeof body.name === "string"
            ? body.name.trim()
            : "";

        const ipv4Type = body.ipv4Type;

        const macAddress = typeof body.macAddress === "string"
            ? body.macAddress.trim().toLowerCase()
            : "";

        const mtu = body.mtu === "" || body.mtu == null
            ? null
            : Number(body.mtu);

        const mss = body.mss === "" || body.mss == null
            ? null
            : Number(body.mss);

        const ipv4Address = typeof body.ipv4Address === "string"
            ? body.ipv4Address.trim()
            : "";

        const ipv4Prefix = body.ipv4Prefix === "" || body.ipv4Prefix == null
            ? null
            : Number(body.ipv4Prefix);

        const ipv4Gateway = typeof body.ipv4Gateway === "string"
            ? body.ipv4Gateway.trim()
            : "";

        const speedDuplex = body.speedDuplex || "auto";

        // Validate description
        if (!name) {
            return res.status(400).json({
                error: "Description cannot be empty"
            });
        }

        if (name.length > 40) {
            return res.status(400).json({
                error: "Description cannot exceed 40 characters"
            });
        }

        const duplicateName = data.interfaces.some(item =>
            item.id !== interfaceItem.id &&
            item.name.toLowerCase() === name.toLowerCase()
        );

        if (duplicateName) {
            return res.status(400).json({
                error: "Interface description already exists"
            });
        }

        // Validate IPv4 configuration
        if (!allowedIpv4Types.includes(ipv4Type)) {
            return res.status(400).json({
                error: "Invalid IPv4 configuration type"
            });
        }

        // Validate MAC address
        if (
            macAddress &&
            !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(macAddress)
        ) {
            return res.status(400).json({
                error: "Invalid MAC address format"
            });
        }

        // Validate MTU
        if (
            mtu !== null &&
            (!Number.isInteger(mtu) || mtu < 576 || mtu > 9000)
        ) {
            return res.status(400).json({
                error: "MTU must be an integer between 576 and 9000"
            });
        }

        // Validate MSS
        if (
            mss !== null &&
            (!Number.isInteger(mss) || mss < 536 || mss > 8960)
        ) {
            return res.status(400).json({
                error: "MSS must be an integer between 536 and 8960"
            });
        }

        // Validate speed and duplex
        if (!allowedSpeedDuplex.includes(speedDuplex)) {
            return res.status(400).json({
                error: "Invalid speed and duplex mode"
            });
        }

        // Validate static IPv4
        if (ipv4Type === "static") {
            if (!net.isIPv4(ipv4Address)) {
                return res.status(400).json({
                    error: "A valid static IPv4 address is required"
                });
            }

            if (
                !Number.isInteger(ipv4Prefix) ||
                ipv4Prefix < 1 ||
                ipv4Prefix > 32
            ) {
                return res.status(400).json({
                    error: "IPv4 prefix must be between 1 and 32"
                });
            }

            if (ipv4Gateway && !net.isIPv4(ipv4Gateway)) {
                return res.status(400).json({
                    error: "Invalid IPv4 gateway"
                });
            }
        }

        // Update interface settings
        interfaceItem.name = name;

        interfaceItem.enabled = body.enabled === true;

        interfaceItem.ipv4Type = ipv4Type;

        interfaceItem.ipv4Address =
            ipv4Type === "static" ? ipv4Address : "";

        interfaceItem.ipv4Prefix =
            ipv4Type === "static" ? ipv4Prefix : null;

        interfaceItem.ipv4Gateway =
            ipv4Type === "static" ? ipv4Gateway : "";

        interfaceItem.macAddress = macAddress;

        interfaceItem.mtu = mtu;

        interfaceItem.mss = mss;

        interfaceItem.speedDuplex = speedDuplex;

        await saveAssignments(data.interfaces);

        res.json({
            success: true,
            message: "Interface settings saved successfully.",
            interface: interfaceItem
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;