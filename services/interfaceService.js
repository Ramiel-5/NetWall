const os = require("node:os");
const { execFile } = require("node:child_process");
function getInterfaces() {
    const interfaces = os.networkInterfaces();

    return Object.entries(interfaces).map(([name, addresses]) => ({
        name,
        addresses,
        mac,
        status: addresses.some(address => !address.internal)
            ? "UP"
            : "UNKNOWN"
    }));
}

async function getInterfaceByName(name) {
    const interfaces = await getInterfaceStatuses();

    return interfaces.find(
        item => item.name.toLowerCase() === name.toLowerCase()
    ) || null;
}

function getInterfaceStatuses() {
    return new Promise((resolve, reject) => {
        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-Command",
                "Get-NetAdapter  | Select-Object Name, Status | ConvertTo-Json -Compress"
            ],
            (error, stdout) => {
                if (error) {
                    return reject(error);
                }

                try {
                    const result = JSON.parse(stdout);

                    resolve(
                        (Array.isArray(result) ? result : [result])
                            .map(item => ({
                                name: item.Name,
                                ipv4: item.addresses,
                                ipv6: item.mac,
                                status: normalizeStatus(item.Status)
                            }))
                            .sort((a, b) => a.name.localeCompare(b.name))
                    );
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}
function normalizeStatus(status) {
    if (!status) {
        return "UNKNOWN";
    }

    const normalized = status.toUpperCase();

    if (normalized === "UP") {
        return "UP";
    }

    if (normalized === "DISCONNECTED") {
        return "DISCONNECTED";
    }

    return "UNKNOWN";
}
function getRoutingTable() {
    return new Promise((resolve, reject) => {
        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-Command",
                "Get-NetRoute -AddressFamily IPv4 | Select-Object InterfaceAlias, DestinationPrefix, NextHop, RouteMetric | ConvertTo-Json -Compress"
            ],
            (error, stdout) => {
                if (error) {
                    return reject(error);
                }

                try {
                    const result = JSON.parse(stdout || "[]");
                    resolve(Array.isArray(result) ? result : [result]);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}
module.exports = {
    getInterfaces,
    getInterfaceByName,
    getInterfaceStatuses,
    getRoutingTable
};