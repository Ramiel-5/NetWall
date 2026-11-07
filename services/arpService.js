const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function getArpTable() {
    try {
        const { stdout } = await execFileAsync(
            "ip",
            ["-j", "-4", "neigh", "show"],
            { timeout: 5000 }
        );

        const entries = JSON.parse(stdout);

        return entries
            .filter(entry => {
                const states = entry.state || [];

                return (
                    entry.dst &&
                    entry.lladdr &&
                    !states.includes("PERMANENT") &&
                    !states.includes("NOARP")
                );
            })
            .map(entry => ({
                ip: entry.dst,
                mac: entry.lladdr.toUpperCase(),
                interface: entry.dev,
                state: (entry.state || ["UNKNOWN"]).join(", ")
            }));

    } catch (error) {
        throw new Error(`Failed to retrieve ARP table: ${error.message}`);
    }
}

module.exports = {
    getArpTable
};