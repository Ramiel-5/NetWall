const { execFile } = require("child_process");
const { stdout } = require("process");

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

            return {
                chain: args[1],
                protocol: getValue("-p", "--protocol") || "all",
                action: getValue("-j", "--jump") || "UNKNOWN",
                port: getValue("--dport", "--dports", "--port") || "any",
                source: getValue("-s", "--source") || "any",
                destination: getValue("-d", "--destination") || "any",
                rawRule: line
            };
        });
}

module.exports = {
    getFirewallRules,
    parseFirewallRules
};