const fs = require("fs");
function getRoutingTable() {
    try {
        const table = fs.readFileSync("/proc/net/route", "utf8");;
        const row = table.trim().split("\n");
        const headers = row[0].trim().split(/\s+/);
        const routes = row.slice(1).map(row => {
            const values = row.trim().split(/\s+/);
            return Object.fromEntries(
                headers.map((header, index) => [
                    header,
                    values[index]
                ]));
        });
        return routes;

    } catch (err) {
        console.error("Error reading file:", err);
	throw err;
    }
}

module.exports = getRoutingTable;
