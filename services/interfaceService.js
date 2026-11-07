
const os = require("os");
const path = require("path");
const fs = require("fs");

const CONFIG_DIR = path.join(__dirname, "..", "data");

const CONFIG_FILE = path.join(CONFIG_DIR, "interfaces.json");

// Get available network interfaces, excluding loopback
function getInterfaces() {
    const interfaces = os.networkInterfaces() || {};

    return Object.fromEntries(
        Object.entries(interfaces).filter(([name]) => {
            const interfaceName = name.toLowerCase();

            return interfaceName !== "lo" &&
                !/^lo\d*$/.test(interfaceName) &&
                !interfaceName.includes("loopback");
        })
    );
}

// Default logical interfaces
function createDefaultAssignments() {
    return {
        interfaces: [
            {
                id: "WAN",
                name: "WAN",
                nic: ""
            },
            {
                id: "LAN",
                name: "LAN",
                nic: ""
            }
        ]
    };
}

// Read interface assignments
async function readAssignments() {
    try {
        const data = await fs.promises.readFile(
            CONFIG_FILE,
            "utf8"
        );

        const config = JSON.parse(data);

        if (!config || !Array.isArray(config.interfaces)) {
            throw new Error("Invalid interface configuration");
        }

        return config;

    } catch (error) {
        if (error.code === "ENOENT") {
            const defaults = createDefaultAssignments();

            await saveAssignments(defaults.interfaces);

            return defaults;
        }

        throw error;
    }
}

// Save interface assignments
async function saveAssignments(assignments) {
    if (!Array.isArray(assignments)) {
        throw new Error("Invalid assignments data");
    }

    await fs.promises.mkdir(CONFIG_DIR, {
        recursive: true
    });

    const config = {
        interfaces: assignments
    };

    await fs.promises.writeFile(
        CONFIG_FILE,
        JSON.stringify(config, null, 2),
        "utf8"
    );
}

module.exports = {
    getInterfaces,
    readAssignments,
    saveAssignments
};
