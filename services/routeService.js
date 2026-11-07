const fs = require("fs/promises");

const ROUTE_FILE = "/proc/net/route";

// Convert hexadecimal IPv4 to normal IPv4
function hexToIPv4(hex) {
    const value = parseInt(hex, 16);

    if (Number.isNaN(value)) {
        throw new Error("Invalid IPv4 hexadecimal value");
    }

    return [
        value & 0xff,
        (value >> 8) & 0xff,
        (value >> 16) & 0xff,
        (value >> 24) & 0xff
    ].join(".");
}

// Convert subnet mask to CIDR prefix
function maskToPrefix(mask) {
    const octets = mask.split(".").map(Number);

    return octets.reduce((total, octet) => {
        return total + octet.toString(2).replace(/0/g, "").length;
    }, 0);
}

// Convert Linux route flags
function parseFlags(value) {
    const flags = parseInt(value, 16);
    let result = "";

    if (flags & 0x1) result += "U";
    if (flags & 0x2) result += "G";
    if (flags & 0x4) result += "H";
    if (flags & 0x200) result += "R";

    return result || "-";
}

// Retrieve IPv4 routing table
async function getRoutingTable() {
    try {
        const content = await fs.readFile(ROUTE_FILE, "utf8");

        const lines = content.trim().split("\n").slice(1);

        return lines
            .filter(line => line.trim())
            .map(line => {
                const fields = line.trim().split(/\s+/);

                const [
                    iface,
                    destinationHex,
                    gatewayHex,
                    flagsHex,
                    refCount,
                    use,
                    metric,
                    maskHex,
                    mtu
                ] = fields;

                const destinationIP = hexToIPv4(destinationHex);
                const gatewayIP = hexToIPv4(gatewayHex);
                const maskIP = hexToIPv4(maskHex);

                const prefix = maskToPrefix(maskIP);

                let destination;

                if (prefix === 0) {
                    destination = "default";
                } else if (prefix === 32) {
                    destination = destinationIP;
                } else {
                    destination = `${destinationIP}/${prefix}`;
                }

                return {
                    destination,
                    gateway: gatewayIP === "0.0.0.0"
                        ? "link"
                        : gatewayIP,
                    flags: parseFlags(flagsHex),
                    use,
                    mtu: Number(mtu) || "-",
                    netif: iface,
                    expire: "-"
                };
            });

    } catch (error) {
        throw new Error(
            `Unable to read routing table: ${error.message}`
        );
    }
}

module.exports = {
    getRoutingTable
};