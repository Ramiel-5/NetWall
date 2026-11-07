const fs = require("fs/promises");
const path = require("path");
const net = require("net");
const { randomUUID } = require("crypto");

const {
    readAssignments
} = require("./interfaceService");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "firewall-rules.json");

const VALID_ACTIONS = ["ACCEPT", "DROP", "REJECT"];
const VALID_PROTOCOLS = ["tcp", "udp", "icmp", "all"];

// Read configuration
async function readConfig() {
    try {
        const content = await fs.readFile(CONFIG_FILE, "utf8");
        const data = JSON.parse(content);

        if (!Array.isArray(data.rules)) {
            throw new Error("Invalid firewall configuration");
        }

        return data;

    } catch (err) {
        if (err.code === "ENOENT") {
            return { rules: [] };
        }

        throw err;
    }
}

// Save configuration
async function saveConfig(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const tempFile = `${CONFIG_FILE}.tmp`;

    await fs.writeFile(
        tempFile,
        JSON.stringify(data, null, 4),
        "utf8"
    );

    await fs.rename(tempFile, CONFIG_FILE);
}

// Get all rules
async function getFirewallRules(interfaceId = null) {
    const data = await readConfig();

    const rules = [...data.rules].sort(
        (a, b) => a.position - b.position
    );

    if (!interfaceId) {
        return rules;
    }

    return rules.filter(
        rule => rule.interface === interfaceId
    );
}

// Validate IP or CIDR
function validNetwork(value) {
    if (!value) return true;

    const parts = value.split("/");

    if (parts.length > 2) return false;
    if (!net.isIPv4(parts[0])) return false;

    if (parts.length === 1) return true;

    if (!/^\d+$/.test(parts[1])) return false;

    return Number(parts[1]) <= 32;
}

// Validate port
function validPort(value) {
    if (!value) return true;

    if (!/^\d+$/.test(String(value))) {
        return false;
    }

    const port = Number(value);

    return port >= 1 && port <= 65535;
}

// Validate rule data
async function validateRule(rule) {
    if (!rule || typeof rule !== "object") {
        throw new Error("Invalid rule data");
    }

    const {
        interface: interfaceId,
        action,
        protocol,
        source,
        sourcePort,
        destination,
        destinationPort,
        gateway,
        description
    } = rule;

    const assignments = await readAssignments();

    const validInterfaces = assignments.interfaces.map(
        item => item.id
    );

    validInterfaces.push("FLOATING");

    if (!validInterfaces.includes(interfaceId)) {
        throw new Error("Invalid interface");
    }

    if (!VALID_ACTIONS.includes(action)) {
        throw new Error("Invalid action");
    }

    if (!VALID_PROTOCOLS.includes(protocol)) {
        throw new Error("Invalid protocol");
    }

    if (
        !validNetwork(source) ||
        !validNetwork(destination)
    ) {
        throw new Error("Invalid source or destination");
    }

    if (
        !validPort(sourcePort) ||
        !validPort(destinationPort)
    ) {
        throw new Error("Invalid port");
    }

    if (
        (sourcePort || destinationPort) &&
        !["tcp", "udp"].includes(protocol)
    ) {
        throw new Error("Ports require TCP or UDP");
    }

    if (gateway && !net.isIPv4(gateway)) {
        throw new Error("Invalid gateway");
    }

    if (
        typeof description !== "string" ||
        description.length > 200
    ) {
        throw new Error("Invalid description");
    }
}

// Create rule
async function addFirewallRule(ruleData) {
    await validateRule(ruleData);

    const data = await readConfig();

    const rule = {
        id: randomUUID(),

        interface: ruleData.interface,
        action: ruleData.action,
        protocol: ruleData.protocol,

        source: ruleData.source || "",
        sourcePort: ruleData.sourcePort || "",

        destination: ruleData.destination || "",
        destinationPort: ruleData.destinationPort || "",

        gateway: ruleData.gateway || "",
        description: ruleData.description.trim(),

        enabled: true,
        position: data.rules.length + 1
    };

    data.rules.push(rule);

    await saveConfig(data);

    return rule;
}

// Update rule
async function updateFirewallRule(id, ruleData) {
    await validateRule(ruleData);

    const data = await readConfig();

    const index = data.rules.findIndex(
        rule => rule.id === id
    );

    if (index === -1) {
        throw new Error("Rule not found");
    }

    const oldRule = data.rules[index];

    data.rules[index] = {
        ...oldRule,

        interface: ruleData.interface,
        action: ruleData.action,
        protocol: ruleData.protocol,

        source: ruleData.source || "",
        sourcePort: ruleData.sourcePort || "",

        destination: ruleData.destination || "",
        destinationPort: ruleData.destinationPort || "",

        gateway: ruleData.gateway || "",
        description: ruleData.description.trim()
    };

    await saveConfig(data);

    return data.rules[index];
}

// Delete rule
async function deleteFirewallRule(id) {
    const data = await readConfig();

    const index = data.rules.findIndex(
        rule => rule.id === id
    );

    if (index === -1) {
        throw new Error("Rule not found");
    }

    data.rules.splice(index, 1);

    data.rules.forEach((rule, index) => {
        rule.position = index + 1;
    });

    await saveConfig(data);
}

// Enable / Disable rule
async function toggleFirewallRule(id) {
    const data = await readConfig();

    const rule = data.rules.find(
        item => item.id === id
    );

    if (!rule) {
        throw new Error("Rule not found");
    }

    rule.enabled = !rule.enabled;

    await saveConfig(data);

    return rule;
}

// Reorder rules
async function reorderFirewallRules(ids) {
    if (!Array.isArray(ids)) {
        throw new Error("Invalid rule order");
    }

    const data = await readConfig();

    const rules = data.rules;

    if (
        ids.length !== rules.length ||
        new Set(ids).size !== rules.length ||
        !ids.every(id => rules.some(rule => rule.id === id))
    ) {
        throw new Error("Invalid rule order");
    }

    ids.forEach((id, index) => {
        const rule = rules.find(item => item.id === id);

        rule.position = index + 1;
    });

    await saveConfig(data);

    return rules;
}

module.exports = {
    getFirewallRules,
    addFirewallRule,
    updateFirewallRule,
    deleteFirewallRule,
    toggleFirewallRule,
    reorderFirewallRules
};