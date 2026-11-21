(() => {
    const elements = {
        hostname: document.getElementById("hostname"),
        operatingSystem: document.getElementById("operating-system"),
        architecture: document.getElementById("architecture"),
        uptime: document.getElementById("uptime"),
        interfaceTableBody: document.getElementById("interface-table-body"),
        interfaceCount: document.getElementById("interface-count"),
        cpuCores: document.getElementById("cpu-cores"),
        memoryUsage: document.getElementById("memory-usage"),
        memoryProgress: document.getElementById("memory-progress"),
        memoryProgressTrack: document.getElementById("memory-progress-track"),
        memoryDetail: document.getElementById("memory-detail"),
        loadAverage: document.getElementById("load-average"),
        dashboardStatus: document.getElementById("dashboard-status"),
        refreshButton: document.getElementById("refresh-button")
    };

    let isLoading = false;

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return "-";
        if (bytes === 0) return "0 B";

        const units = ["B", "KB", "MB", "GB", "TB"];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );

        return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
    }

    function createCell(text, className = "") {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (className) cell.className = className;
        return cell;
    }

    function renderInterfaces(interfaces) {
        const rows = Array.isArray(interfaces) ? interfaces : [];
        elements.interfaceTableBody.replaceChildren();
        elements.interfaceCount.textContent = `${rows.length} interface${rows.length === 1 ? "" : "s"}`;

        if (rows.length === 0) {
            const row = document.createElement("tr");
            const cell = createCell("No logical interfaces configured.", "dashboard-empty");
            cell.colSpan = 5;
            row.appendChild(cell);
            elements.interfaceTableBody.appendChild(row);
            return;
        }

        rows.forEach(item => {
            const row = document.createElement("tr");
            const addressList = Array.isArray(item.addresses) ? item.addresses : [];
            const addressText = addressList.length
                ? addressList.map(address => `${address.address} (${address.family})`).join(
                    ", "
                )
                : (item.physical ? "No IP address" : "Not assigned");

            row.append(
                createCell(item.logical || item.id || "Unknown"),
                createCell(item.physical || "Not assigned"),
                createCell(addressText),
                createCell(item.mac || "-"),
                createCell(
                    item.status || "unknown",
                    `interface-status ${item.status === "up" ? "up" : item.status === "unassigned" ? "unassigned" : "down"}`
                )
            );

            elements.interfaceTableBody.appendChild(row);
        });
    }

    function renderSystem(system) {
        elements.hostname.textContent = system.hostname || "-";
        elements.operatingSystem.textContent = system.operatingSystem || "-";
        elements.architecture.textContent = system.architecture || "-";
        elements.uptime.textContent = system.uptime || "-";
    }

    function renderResources(resources) {
        const usage = Math.min(100, Math.max(0, Number(resources.memoryUsage) || 0));

        elements.cpuCores.textContent = resources.cpuCores ?? "-";
        elements.memoryUsage.textContent = `${usage.toFixed(1)}%`;
        elements.memoryProgress.style.width = `${usage}%`;
        elements.memoryProgressTrack.setAttribute("aria-valuenow", String(usage));
        elements.memoryDetail.textContent =
            `${formatBytes(resources.usedMemory)} used / ${formatBytes(resources.totalMemory)} total`;

        const load = Array.isArray(resources.loadAverage) ? resources.loadAverage : [];
        elements.loadAverage.textContent = load.length
            ? load.map(value => Number(value).toFixed(2)).join(" / ")
            : "Unavailable";
    }

    async function loadDashboard() {
        if (isLoading) return;
        isLoading = true;
        elements.refreshButton.disabled = true;
        elements.refreshButton.classList.add("is-loading");
        elements.dashboardStatus.textContent = "Updating dashboard...";

        try {
            const response = await fetch("/data", {
                method: "GET",
                cache: "no-store",
                headers: { Accept: "application/json" }
            });

            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.message || "Invalid dashboard response");
            }

            renderSystem(result.data.system || {});
            renderInterfaces(result.data.interfaces);
            renderResources(result.data.resources || {});

            elements.dashboardStatus.textContent =
                `Last updated: ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            console.error("Dashboard error:", error);
            elements.dashboardStatus.textContent =
                `Unable to update dashboard: ${error.message}`;
        } finally {
            isLoading = false;
            elements.refreshButton.disabled = false;
            elements.refreshButton.classList.remove("is-loading");
        }
    }

    elements.refreshButton.addEventListener("click", loadDashboard);
    loadDashboard();
    window.setInterval(loadDashboard, 15000);
})();