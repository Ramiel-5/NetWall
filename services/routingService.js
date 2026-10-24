const fs = require("fs");

function getRoutingTable() {
    try {
        const table = fs.readFileSync("/proc/net/route", "utf8");
        const rows = table.trim().split("\n");
        const headers = rows[0].trim().split(/\s+/);

        const routes = rows.slice(1).map(row => {
            const values = row.trim().split(/\s+/);

            return Object.fromEntries(
                headers.map((header, index) => [
                    header,
                    values[index]
                ])
            );
        });
        routes.Destination = hexToIPv4(routes.Destination);
        routes.Gateway = hexToIPv4(routes.Gateway);
        routes.Flags = hexToFlags(routes.Flags);


        return routes;
    } catch (err) {
        console.error("Error reading routing table:", err);
        throw err;
    }
}
function hexToFlags(hex) {
    const flags = parseInt(hex, 16);
    let result = "";

    if (flags & 0x1) result += "U";
    if (flags & 0x2) result += "G";
    if (flags & 0x4) result += "H";
    if (flags & 0x8) result += "R";
    if (flags & 0x10) result += "D";
    if (flags & 0x20) result += "M";

    return result || "-";
}
function hexToIpv4(hex) {
    const value = hex.match(/../g);

    return value
        .reverse()
        .map(byte => parseInt(byte, 16))
        .join(".");
}

module.exports = getRoutingTable;