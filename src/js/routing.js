let isUpdating = false;

async function updateRoutingTable() {
    if (isUpdating) return;

    isUpdating = true;

    const refreshButton = document.getElementById("refresh-button");
    const tbody = document.getElementById("route-list");
    const statusText = document.getElementById("update-status");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Refreshing...";
    }

    if (!tbody || !statusText) {
        console.error("Routing table elements not found");
        isUpdating = false;

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }

        return;
    }

    statusText.textContent = "Updating...";
    statusText.className = "";

    try {
        const response = await fetch("/routing/data");

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const table = await response.json();

        if (!Array.isArray(table)) {
            throw new Error("Invalid routing table data");
        }

        const currentRows = new Map(
            [...tbody.querySelectorAll("tr[data-routing]")].map(row => [
                row.dataset.route,
                row
            ])
        );

        const columns = [
            ["Iface", "Interface"],
            ["Destination", "Destination"],
            ["Gateway", "Gateway"],
            ["Flags", "Flags"],
            ["RefCnt", "RefCnt"],
            ["Use", "Use"],
            ["Metric", "Metric"],
            ["Mask", "Mask"],
            ["MTU", "MTU"],
            ["Window", "Window"],
            ["IRTT", "IRTT"]
        ];
table.forEach(route => {
    const key = [
        route.Iface,
        route.Destination,
        route.Gateway
    ].join("|");

    let row = currentRows.get(key);

    if (!row) {
        row = document.createElement("tr");
        row.dataset.routing = "";
        row.dataset.route = key;

        columns.forEach(() => {
            row.appendChild(document.createElement("td"));
        });

        tbody.appendChild(row);
    }

    columns.forEach(([field], index) => {
        row.cells[index].textContent = route[field] ?? "N/A";
    });

    currentRows.delete(key);
});

currentRows.forEach(row => row.remove());
        statusText.textContent =
            `Connected · Last updated: ${new Date().toLocaleTimeString()}`;
        statusText.className = "connected";

    } catch (error) {
        console.error("Failed to update routing table:", error);

        statusText.textContent = "Connection error · Failed to update";
        statusText.className = "connection-error";

    } finally {
        isUpdating = false;

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }
    }
}


const refreshButton = document.getElementById("refresh-button");

if (refreshButton) {
    refreshButton.addEventListener("click", updateRoutingTable);
}


updateRoutingTable();

setInterval(updateRoutingTable, 10000);
