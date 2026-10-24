const { execFile } = require("child_process");
const { stdout } = require("process");

function getFirewallRules() {
    return new Promise((resolve, reject) => {
        const dir = getDir("iptables")
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
        (error, stdout, stderr) => {
            resolve(stdout);
        }
    });
}
module.exports = getFirewallRules;