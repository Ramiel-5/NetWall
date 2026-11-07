const hostname = document.getElementById("hostname");
const operatingSystem = document.getElementById("operating-system");
const architecture = document.getElementById("architecture");
const uptime = document.getElementById("uptime");

const interfaceTableBody = document.getElementById("interface-table-body");

const cpuCores = document.getElementById("cpu-cores");
const memoryUsage = document.getElementById("memory-usage");
const memoryProgress = document.getElementById("memory-progress");
const memoryDetail = document.getElementById("memory-detail");
const loadAverage = document.getElementById("load-average");

const dashboardStatus = document.getElementById("dashboard-status");
const refreshButton = document.getElementById("refresh-button");

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function renderInterfaces(interfaces) {
    interfaceTableBody.replaceChildren();

    if (!interfaces || interfaces.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "No assigned interfaces found.";

        row.appendChild(cell);
        interfaceTableBody.appendChild(row);

        return;
    }

    interfaces.forEach(item => {
        const row = document.createElement("tr");

        const logicalCell = document.createElement("td");
        const physicalCell = document.createElement("td");
        const addressCell = document.createElement("td");
        const statusCell = document.createElement("td");

        logicalCell.textContent = item.logical;
        physicalCell.textContent = item.physical;

        const addresses = item.addresses || [];

        addressCell.textContent = addresses.length
            ? addresses.map(address =>
                `${address.family}: ${address.address}`
            ).join(", ")
            : "No IP address";

        statusCell.textContent = item.status;

        statusCell.className =
            item.status === "up"
                ? "interface-status up"
                : "interface-status down";

        row.append(
            logicalCell,
            physicalCell,
            addressCell,
            statusCell
        );

        interfaceTableBody.appendChild(row);
    });
}

function renderSystem(system) {
    hostname.textContent = system.hostname;
    operatingSystem.textContent = system.operatingSystem;
    architecture.textContent = system.architecture;
    uptime.textContent = system.uptime;
}

function renderResources(resources) {
    cpuCores.textContent = resources.cpuCores;

    memoryUsage.textContent = `${resources.memoryUsage}%`;

    memoryProgress.style.width = `${resources.memoryUsage}%`;

    memoryDetail.textContent =
        `${formatBytes(resources.usedMemory)} / ${formatBytes(resources.totalMemory)}`;

    loadAverage.textContent =
        resources.loadAverage
            .map(value => value.toFixed(2))
            .join(" / ");
}

async function loadDashboard() {
    try {
        refreshButton.disabled = true;
        dashboardStatus.textContent = "Updating dashboard...";

        const response = await fetch("/data");

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "Unable to load dashboard");
        }

        const data = result.data;

        renderSystem(data.system);
        renderInterfaces(data.interfaces);
        renderResources(data.resources);

        dashboardStatus.textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error("Dashboard error:", error);

        dashboardStatus.textContent =
            "Failed to load dashboard data.";

    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener("click", loadDashboard);

loadDashboard();

setInterval(loadDashboard, 15000);