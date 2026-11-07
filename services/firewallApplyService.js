const { execFile } = require("child_process");
const path = require("path");

const PYTHON = "/usr/bin/python3";

const SCRIPT = path.join(
    __dirname,
    "..",
    "python",
    "command.py"
);

let applying = null;

function applyFirewallRules() {
    // Prevent multiple simultaneous executions
    if (applying) {
        return applying;
    }

    applying = new Promise((resolve, reject) => {
        execFile(
            "sudo",
            ["-n", PYTHON, SCRIPT],
            {
                timeout: 15000,
                maxBuffer: 1024 * 1024
            },
            (error, stdout, stderr) => {
                if (error) {
                    return reject(
                        new Error(
                            stderr.trim() ||
                            error.message
                        )
                    );
                }

                resolve({
                    message: stdout.trim()
                });
            }
        );
    });

    return applying.finally(() => {
        applying = null;
    });
}

module.exports = {
    applyFirewallRules
};