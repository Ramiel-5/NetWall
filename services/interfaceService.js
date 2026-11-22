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

function createDefaultAssignments() {
    return {
        interfaces: [
            {
                id: "WAN",
                name: "WAN",
                nic: "",
                enabled: true,
                ipv4Type: "dhcp",
                address: "",
                prefix: "",
                gateway: "",
                mtu: 1500
            },
            {
                id: "LAN",
                name: "LAN",
                nic: "",
                enabled:true,
                ipv4Type: "static",
                address: "192.168.10.10",
                prefix: "24",
                gateway: "",
                mtu: 1500
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
        recursive: true,
        mode: 0o700
    });

    const config = {
        interfaces: assignments
    };

    const tempFile = `${CONFIG_FILE}.tmp`;

    await fs.promises.writeFile(
        tempFile,
        JSON.stringify(config, null, 2),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    await fs.promises.rename(tempFile, CONFIG_FILE);
}

module.exports = {
    getInterfaces,
    readAssignments,
    saveAssignments
};