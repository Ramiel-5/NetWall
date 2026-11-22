
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

// Get available network ports
router.get("/ports", (req, res, next) => {
    try {
        const interfaces = getInterfaces();
        res.json({ interfaces });
    } catch (error) {
        next(error);
    }
});

// Get assignments
router.get("/assignments", async (req, res, next) => {
    try {
        const data = await readAssignments();

        res.json({
            assignments: data.interfaces
        });
    } catch (error) {
        next(error);
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

            if (name.length > 40) {
                return res.status(400).json({
                    error: "Interface name cannot exceed 40 characters"
                });
            }

            if (nic && !availableNics.includes(nic)) {
                return res.status(400).json({
                    error: `NIC ${nic} is unavailable`
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

        // WAN must always exist
        if (!normalized.some(item => item.id === "WAN")) {
            return res.status(400).json({
                error: "WAN interface cannot be deleted"
            });
        }

        // Logical interfaces cannot exceed physical interfaces
        if (normalized.length > availableNics.length) {
            return res.status(400).json({
                error: "Logical interface count cannot exceed physical interface count"
            });
        }

        // Check duplicate IDs
        const ids = normalized.map(item => item.id);

        if (new Set(ids).size !== ids.length) {
            return res.status(400).json({
                error: "Duplicate interface IDs"
            });
        }

        // Check duplicate descriptions
        const names = normalized.map(item => item.name.toLowerCase());

        if (new Set(names).size !== names.length) {
            return res.status(400).json({
                error: "Duplicate interface names"
            });
        }

        // Check duplicate physical NIC assignments
        const selectedNics = normalized
            .map(item => item.nic)
            .filter(Boolean);

        if (new Set(selectedNics).size !== selectedNics.length) {
            return res.status(400).json({
                error: "A NIC cannot be assigned to multiple interfaces"
            });
        }

        await saveAssignments(normalized);

        res.json({
            success: true,
            message: "Assignments saved successfully."
        });

    } catch (error) {
        next(error);
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

    } catch (error) {
        next(error);
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

        // General settings
        const name =
            typeof body.name === "string"
                ? body.name.trim()
                : "";

        const enabled = body.enabled;

        // IPv4 settings
        const ipv4Type = body.ipv4Type;

        const ipv4Address =
            typeof body.ipv4Address === "string"
                ? body.ipv4Address.trim()
                : "";

        const ipv4Gateway =
            typeof body.ipv4Gateway === "string"
                ? body.ipv4Gateway.trim()
                : "";

        const ipv4Prefix =
            body.ipv4Prefix === "" || body.ipv4Prefix == null
                ? null
                : Number(body.ipv4Prefix);

        // MTU
        const mtu =
            body.mtu === "" || body.mtu == null
                ? null
                : Number(body.mtu);

        // IPv6 settings
        const dhcp6 = body.dhcp6;
        const acceptRa = body.acceptRa;

        // DNS settings
        const dns = body.dns;

        // Validate enabled
        if (typeof enabled !== "boolean") {
            return res.status(400).json({
                error: "Invalid interface enabled value"
            });
        }

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

        // Check duplicate description
        const duplicateName = data.interfaces.some(item =>
            item.id !== interfaceItem.id &&
            item.name.toLowerCase() === name.toLowerCase()
        );

        if (duplicateName) {
            return res.status(400).json({
                error: "This description is already used"
            });
        }

        // Validate IPv4 type
        const allowedIpv4Types = [
            "none",
            "dhcp",
            "static"
        ];

        if (!allowedIpv4Types.includes(ipv4Type)) {
            return res.status(400).json({
                error: "Invalid IPv4 configuration type"
            });
        }

        // Validate IPv4 static configuration
        if (ipv4Type === "static") {
            if (!net.isIPv4(ipv4Address)) {
                return res.status(400).json({
                    error: "Invalid IPv4 address"
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

        // Validate MTU
        if (
            mtu !== null &&
            (!Number.isInteger(mtu) || mtu < 576 || mtu > 9000)
        ) {
            return res.status(400).json({
                error: "MTU must be between 576 and 9000"
            });
        }

        // Validate DHCPv6
        if (typeof dhcp6 !== "boolean") {
            return res.status(400).json({
                error: "Invalid DHCPv6 value"
            });
        }

        // Validate Accept RA
        if (typeof acceptRa !== "boolean") {
            return res.status(400).json({
                error: "Invalid Accept RA value"
            });
        }

        // Validate DNS
        if (!Array.isArray(dns)) {
            return res.status(400).json({
                error: "DNS servers must be an array"
            });
        }

        const normalizedDns = [];

        for (const address of dns) {
            if (typeof address !== "string") {
                return res.status(400).json({
                    error: "Invalid DNS server address"
                });
            }

            const trimmedAddress = address.trim();

            if (!trimmedAddress) {
                continue;
            }

            if (net.isIP(trimmedAddress) === 0) {
                return res.status(400).json({
                    error: `Invalid DNS server address: ${trimmedAddress}`
                });
            }

            if (!normalizedDns.includes(trimmedAddress)) {
                normalizedDns.push(trimmedAddress);
            }
        }

        // Update interface configuration
        interfaceItem.enabled = enabled;

        interfaceItem.name = name;

        interfaceItem.ipv4Type = ipv4Type;

        interfaceItem.ipv4Address =
            ipv4Type === "static"
                ? ipv4Address
                : "";

        interfaceItem.ipv4Prefix =
            ipv4Type === "static"
                ? ipv4Prefix
                : null;

        interfaceItem.ipv4Gateway =
            ipv4Type === "static"
                ? ipv4Gateway
                : "";

        interfaceItem.mtu = mtu;

        interfaceItem.dhcp6 = dhcp6;

        interfaceItem.acceptRa = acceptRa;

        interfaceItem.dns = normalizedDns;

        // Save configuration to JSON
        await saveAssignments(data.interfaces);

        res.json({
            success: true,
            message: "Interface settings saved successfully.",
            interface: interfaceItem
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
