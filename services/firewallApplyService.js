const { execFile } = require("child_process");
const path = require("path");

const PYTHON = process.env.NETWALL_PYTHON || "/usr/bin/python3";
const SCRIPT = path.join(__dirname, "..", "python", "command.py");
const PROJECT_DIR = path.join(__dirname, "..");
const TIMEOUT = 20000;
let applyQueue = Promise.resolve();

function executeApply() {
    return new Promise((resolve, reject) => {
        execFile(
            "sudo",
            ["-n", PYTHON, SCRIPT],
            {
                cwd: PROJECT_DIR,
                timeout: TIMEOUT,
                maxBuffer: 1024 * 1024,
                windowsHide: true
            },
            (error, stdout, stderr) => {
                if (error) {
                    const details = (stderr || stdout || error.message).trim();
                    const applyError = new Error(details || "Unable to apply firewall rules");
                    applyError.code = "FIREWALL_APPLY_FAILED";
                    return reject(applyError);
                }
                resolve({ message: (stdout || "Firewall rules applied").trim() });
            }
        );
    });
}

// Queue applications instead of sharing an in-flight promise. This prevents a
// manual apply started before a config update from being mistaken for the new apply.
function applyFirewallRules() {
    const current = applyQueue.then(executeApply);
    applyQueue = current.catch(() => {});
    return current;
}

module.exports = { applyFirewallRules };
