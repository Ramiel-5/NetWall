
const { execFile } = require("child_process");


function getFirewallRules() {
    return new Promise(async (resolve, reject) => {
        const dir = await getDir("iptables")
        execFile(
            "sudo",
            ["-n", dir, "-S"],
            (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }

                resolve(stdout);
            }
        );
    });
}

function getDir(name) {
    return new Promise((resolve, reject) => {
        execFile(
            "which",
            [name],
            (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }

                resolve(stdout.trim());
            }
        );
    });
}
function parseFirewallRules(rawRules) {
    return rawRules
        .split("\n")
        .filter(line => line.startsWith("-A "))
        .map(line => {
            const args = line.match(/"[^"]*"|'[^']*'|\S+/g) || [];

            const getValue = (...options) => {
                for (let i = 0; i < args.length; i++) {
                    if (options.includes(args[i])) {
                        return args[i + 1] ?? null;
                    }
                }

                return null;

            };
            const comment = (getValue("--comment") || "")
                .replace(/^["']|["']$/g, "");

            const managed = comment.startsWith("webfw:");
            const rawRule = line;

            return {
                id: managed ? comment.slice("webfw:".length) : null,
                managed,
                chain: args[1],
                protocol: getValue("-p", "--protocol") || "all",
                action: getValue("-j", "--jump") || "UNKNOWN",
                port: getValue("--dport", "--dports", "--port") || "any",
                source: getValue("-s", "--source") || "any",
                destination: getValue("-d", "--destination") || "any",
                rawRule
            };
        });
}


const net = require("net");

async function addFirewallRule(data) {
    const { chain, protocol, action, port, source, destination } = data;

    const validChains = ["INPUT", "FORWARD", "OUTPUT"];
    const validProtocols = ["tcp", "udp", "icmp", "all"];
    const validActions = ["ACCEPT", "DROP", "REJECT"];

    if (!validChains.includes(chain)) {
        throw new Error("Invalid chain");
    }

    if (!validProtocols.includes(protocol)) {
        throw new Error("Invalid protocol");
    }

    if (!validActions.includes(action)) {
        throw new Error("Invalid action");
    }

    if (port && (
        !["tcp", "udp"].includes(protocol) ||
        !/^\d+$/.test(port) ||
        Number(port) < 1 ||
        Number(port) > 65535
    )) {
        throw new Error("Invalid port or protocol");
    }

    function validNetwork(value) {
        if (!value) return true;

        const parts = value.split("/");
        if (parts.length > 2 || !net.isIPv4(parts[0])) return false;
        if (parts.length === 1) return true;
        if (!/^\d+$/.test(parts[1])) return false;

        const maxPrefix = 32;
        return Number(parts[1]) <= maxPrefix;
    }

    if (!validNetwork(source) || !validNetwork(destination)) {
        throw new Error("Invalid source or destination IP/CIDR");
    }


    const args = [
        "/usr/local/sbin/firewall-rule-add",
        chain,
        protocol,
        action,
        port || "-",
        source || "-",
        destination || "-"
    ];

    return new Promise((resolve, reject) => {
        execFile("sudo", ["-n", ...args], (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr || error.message));
            }

            resolve();
        });
    });

}
function deleteFirewallRule(id) {
    return new Promise((resolve, reject) => {
        execFile(
            "sudo",
            ["-n", "/usr/local/sbin/firewall-rule-delete", id],
            (error, stdout, stderr) => {
                if (error) {
                    return reject(
                        new Error(stderr.trim() || error.message)
                    );
                }

                resolve(stdout.trim());
            }
        );
    });
}

module.exports = {
    getFirewallRules,
    parseFirewallRules,
    addFirewallRule,
    deleteFirewallRule
};