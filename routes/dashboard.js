const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");

const {
    getInterfaces,
    readAssignments
} = require("../services/interfaceService");

const router = express.Router();

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
}

function getInterfaceStatus(name) {
    if (process.platform !== "linux") {
        return "unknown";
    }

    try {
        const statusPath = path.join("/sys/class/net", name, "operstate");
        const status = fs.readFileSync(statusPath, "utf8").trim().toLowerCase();
        return status || "unknown";
    } catch {
        return "unknown";
    }
}

async function getDashboardData() {
    const physicalInterfaces = getInterfaces() || {};
    const assignmentConfig = await readAssignments();
    const assignments = Array.isArray(assignmentConfig.interfaces)
        ? assignmentConfig.interfaces
        : [];

    // Keep every configured logical interface visible, including unassigned ones.
    const interfaceList = assignments.map(item => {
        const physical = typeof item.nic === "string" ? item.nic.trim() : "";
        const addresses = physicalInterfaces[physical] || [];
        const firstAddress = addresses[0] || {};

        return {
            logical: item.name || item.id || "Unknown",
            id: item.id || "",
            physical,
            status: physical ? getInterfaceStatus(physical) : "unassigned",
            mac: firstAddress.mac || "-",
            addresses: addresses
                .filter(address => !address.internal)
                .map(address => ({
                    address: address.address,
                    family: address.family,
                    cidr: address.cidr
                }))
        };
    });

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = Math.max(0, totalMemory - freeMemory);
    const cpuList = os.cpus();

    return {
        system: {
            hostname: os.hostname(),
            operatingSystem: `${os.type()} ${os.release()}`,
            architecture: os.arch(),
            uptime: formatUptime(os.uptime())
        },
        interfaces: interfaceList,
        resources: {
            cpuCores: cpuList.length,
            loadAverage: os.loadavg(),
            totalMemory,
            usedMemory,
            freeMemory,
            memoryUsage: totalMemory
                ? Number(((usedMemory / totalMemory) * 100).toFixed(1))
                : 0
        }
    };
}

router.get("/", (req, res) => {
    res.render("dashboard", {
        activePage: "dashboard"
    });
});

router.get("/data", async (req, res) => {
    try {
        const data = await getDashboardData();

        res.set("Cache-Control", "no-store");
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve dashboard data"
        });
    }
});

module.exports = router;