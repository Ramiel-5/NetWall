const fs = require("fs/promises");
const path = require("path");
const net = require("net");
const { randomUUID } = require("crypto");
const { readAssignments } = require("./interfaceService");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "firewall-rules.json");
const VALID_ACTIONS = ["ACCEPT", "DROP", "REJECT"];
const VALID_PROTOCOLS = ["tcp", "udp", "icmp", "all"];
let transactionQueue = Promise.resolve();

async function readConfig() {
    try {
        const content = await fs.readFile(CONFIG_FILE, "utf8");
        const data = JSON.parse(content);
        if (!data || !Array.isArray(data.rules)) {
            throw new Error("Invalid firewall configuration: rules must be an array");
        }
        return data;
    } catch (error) {
        if (error.code === "ENOENT") return { rules: [] };
        throw error;
    }
}

async function saveConfig(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`;
    try {
        await fs.writeFile(tempFile, JSON.stringify(data, null, 4), { encoding: "utf8", mode: 0o600 });
        await fs.rename(tempFile, CONFIG_FILE);
    } catch (error) {
        await fs.unlink(tempFile).catch(() => {});
        throw error;
    }
}

async function getFirewallRules(interfaceId = null) {
    const { rules } = await readConfig();
    const sorted = [...rules].sort((a, b) => a.position - b.position);
    return interfaceId ? sorted.filter(rule => rule.interface === interfaceId) : sorted;
}

function validNetwork(value) {
    if (value === "" || value === undefined || value === null) return true;
    if (typeof value !== "string") return false;
    const parts = value.split("/");
    if (parts.length > 2 || !net.isIPv4(parts[0])) return false;
    if (parts.length === 1) return true;
    return /^\d+$/.test(parts[1]) && Number(parts[1]) <= 32;
}

function validPort(value) {
    if (value === "" || value === undefined || value === null) return true;
    if (!/^\d+$/.test(String(value))) return false;
    const port = Number(value);
    return port >= 1 && port <= 65535;
}

async function validateRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new Error("Invalid rule data");
    }

    const interfaceId = String(rule.interface || "");
    const action = String(rule.action || "");
    const protocol = String(rule.protocol || "");
    const source = rule.source || "";
    const sourcePort = rule.sourcePort || "";
    const destination = rule.destination || "";
    const destinationPort = rule.destinationPort || "";
    const description = rule.description === undefined ? "" : rule.description;

    const assignments = await readAssignments();
    const assignedInterfaces = assignments.interfaces.filter(item => item.nic);
    const validInterfaces = assignedInterfaces.map(item => item.id);
    validInterfaces.push("FLOATING");

    if (!validInterfaces.includes(interfaceId)) {
        throw new Error("Select an assigned interface");
    }
    if (!VALID_ACTIONS.includes(action)) throw new Error("Invalid action");
    if (!VALID_PROTOCOLS.includes(protocol)) throw new Error("Invalid protocol");
    if (!validNetwork(source) || !validNetwork(destination)) {
        throw new Error("Source and destination must be valid IPv4 addresses or CIDR networks");
    }
    if (!validPort(sourcePort) || !validPort(destinationPort)) {
        throw new Error("Ports must be between 1 and 65535");
    }
    if ((sourcePort || destinationPort) && !["tcp", "udp"].includes(protocol)) {
        throw new Error("Source and destination ports require TCP or UDP");
    }
    if (rule.gateway) {
        throw new Error("Gateway policy routing is not supported yet");
    }
    if (typeof description !== "string" || description.length > 200) {
        throw new Error("Description must be 200 characters or fewer");
    }
}

function normalizeRule(ruleData, existing = {}) {
    return {
        ...existing,
        interface: ruleData.interface,
        action: ruleData.action,
        protocol: ruleData.protocol,
        source: String(ruleData.source || "").trim(),
        sourcePort: ruleData.sourcePort === "" ? "" : String(ruleData.sourcePort || ""),
        destination: String(ruleData.destination || "").trim(),
        destinationPort: ruleData.destinationPort === "" ? "" : String(ruleData.destinationPort || ""),
        description: String(ruleData.description || "").trim()
    };
}

async function addFirewallRule(ruleData) {
    await validateRule(ruleData);
    const data = await readConfig();
    const rule = {
        id: randomUUID(),
        ...normalizeRule(ruleData),
        enabled: true,
        position: data.rules.reduce((max, item) => Math.max(max, Number(item.position) || 0), 0) + 1
    };
    data.rules.push(rule);
    await saveConfig(data);
    return rule;
}

async function updateFirewallRule(id, ruleData) {
    await validateRule(ruleData);
    const data = await readConfig();
    const index = data.rules.findIndex(rule => rule.id === id);
    if (index === -1) throw new Error("Rule not found");
    data.rules[index] = normalizeRule(ruleData, data.rules[index]);
    await saveConfig(data);
    return data.rules[index];
}

async function deleteFirewallRule(id) {
    const data = await readConfig();
    const index = data.rules.findIndex(rule => rule.id === id);
    if (index === -1) throw new Error("Rule not found");
    data.rules.splice(index, 1);
    data.rules.forEach((rule, index) => { rule.position = index + 1; });
    await saveConfig(data);
}

async function toggleFirewallRule(id) {
    const data = await readConfig();
    const rule = data.rules.find(item => item.id === id);
    if (!rule) throw new Error("Rule not found");
    rule.enabled = !rule.enabled;
    await saveConfig(data);
    return rule;
}

async function reorderFirewallRules(ids) {
    if (!Array.isArray(ids)) throw new Error("Invalid rule order");
    const data = await readConfig();
    const rules = data.rules;
    if (ids.length !== rules.length || new Set(ids).size !== rules.length ||
        !ids.every(id => rules.some(rule => rule.id === id))) {
        throw new Error("Invalid rule order");
    }
    ids.forEach((id, index) => {
        const rule = rules.find(item => item.id === id);
        rule.position = index + 1;
    });
    await saveConfig(data);
    return [...rules].sort((a, b) => a.position - b.position);
}

// Serialize mutations. If applying iptables fails, restore the previous JSON and
// re-apply the previous configuration so the UI and firewall do not drift apart.
function runFirewallTransaction(operation) {
    const current = transactionQueue.then(async () => {
        const before = await readConfig();
        try {
            const result = await operation();
            const { applyFirewallRules } = require("./firewallApplyService");
            await applyFirewallRules();
            return result;
        } catch (error) {
            await saveConfig(before);
            try {
                const { applyFirewallRules } = require("./firewallApplyService");
                await applyFirewallRules();
            } catch (rollbackError) {
                error.message += `; rollback apply also failed: ${rollbackError.message}`;
            }
            throw error;
        }
    });
    transactionQueue = current.catch(() => {});
    return current;
}

module.exports = {
    getFirewallRules,
    addFirewallRule,
    updateFirewallRule,
    deleteFirewallRule,
    toggleFirewallRule,
    reorderFirewallRules,
    runFirewallTransaction
};
