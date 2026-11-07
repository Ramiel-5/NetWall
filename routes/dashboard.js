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
        return "Unknown";
    }

    try {
        const statusPath = path.join(
            "/sys/class/net",
            name,
            "operstate"
        );

        return fs.readFileSync(statusPath, "utf8").trim();
    } catch {
        return "Unknown";
    }
}

function getDashboardData() {
    const interfaces = getInterfaces() || {};
    const assignments = readAssignments() || {};

    const interfaceList = Object.entries(assignments)
        .filter(([logical, physical]) => {
            return physical && interfaces[physical];
        })
        .map(([logical, physical]) => {
            const addresses = interfaces[physical] || [];

            return {
                logical,
                physical,
                status: getInterfaceStatus(physical),
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
    const usedMemory = totalMemory - freeMemory;

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
                ? ((usedMemory / totalMemory) * 100).toFixed(1)
                : 0
        }
    };
}

router.get("/", (req, res) => {
    res.render("dashboard", {
        activePage: "dashboard"
    });
});

router.get("/data", (req, res) => {
    try {
        res.json({
            success: true,
            data: getDashboardData()
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