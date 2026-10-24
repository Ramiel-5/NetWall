const { execFile } = require("child_process");

function getFirewallRules() {
    return new Promise((resolve, reject) => {
        execFile(
            "sudo",
            ["iptables", "-S"],
            (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }

                resolve(stdout);
            }
        );
    });
}

module.exports = getFirewallRules;