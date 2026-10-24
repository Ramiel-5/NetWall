const { execFile } = require("child_process");
const { stdout } = require("process");

function getFirewallRules() {
    return new Promise(async (resolve, reject) => {
        const dir = await getDir("iptables")
        execFile(
            "sudo",
            [dir, "-S"],
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
module.exports = getFirewallRules;