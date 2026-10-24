
let isUpdating = false;
async function updateInterfaces() {
    if (isUpdating) return;

    isUpdating = true;
    const refreshButton = document.getElementById("refresh-button");
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    try {
        const response = await fetch("/interfaces/data");

        if (!response.ok) {
            throw new Error("Failed to fetch interfaces");
        }

        const interfaces = await response.json();
        const total = interfaces.length;

        const upCount = interfaces.filter(
            item => item.status.toUpperCase() === "UP"
        ).length;

        const summary = document.getElementById("interface-summary");

        summary.textContent = `Total interfaces: ${total} | UP: ${upCount} | Not UP: ${total - upCount}`;
        const tbody = document.getElementById("interface-list");
        const statusText = document.getElementById("update-status");
        statusText.textContent = "Updating...";
        const currentRows = new Map(
            [...tbody.querySelectorAll("tr[data-interface]")].map(row => [
                row.dataset.interface,
                row
            ])
        );
        statusText.textContent =
            `Connected · Last updated: ${new Date().toLocaleTimeString()}`;
        statusText.className = "connected";
        filterInterfaces();
        interfaces.forEach(item => {
            let row = currentRows.get(item.name);

            if (!row) {
                row = document.createElement("tr");
                row.dataset.interface = item.name;

                const nameCell = document.createElement("td");
                nameCell.textContent = item.name;

                const statusCell = document.createElement("td");
                const statusElement = document.createElement("span");
                statusElement.className = "status";

                statusCell.appendChild(statusElement);
                row.append(nameCell, statusCell);
                tbody.appendChild(row);
            }

            const statusElement = row.querySelector(".status");
            statusElement.textContent = item.status;
            statusElement.className =
                "status " + item.status.toLowerCase();

            currentRows.delete(item.name);
        });

        currentRows.forEach(row => row.remove());

    } catch (error) {

        console.error("Failed to update interfaces:", error);

        const statusText = document.getElementById("update-status");
        statusText.textContent = "Connection error · Failed to update";
        statusText.className = "connection-error";
    }

    finally {

        isUpdating = false;
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";

    }
}

function filterInterfaces() {
    const selectedStatus = document.getElementById("status-filter").value;
    const searchText = document
        .getElementById("interface-search")
        .value.trim()
        .toLowerCase();
    const rows = document.querySelectorAll("#interface-list tr[data-interface]");

    rows.forEach(row => {
        const status = row.querySelector(".status")
            .textContent.trim().toUpperCase();

        const name = row.dataset.interface.toLowerCase();

        const matchesStatus =
            selectedStatus === "ALL" || status === selectedStatus;

        const matchesName = name.includes(searchText);

        row.style.display =
            matchesStatus && matchesName ? "" : "none";
    });
    const visibleRows = [...rows].filter(
        row => row.style.display !== "none"
    );

    const noResults = document.getElementById("no-results");

    noResults.style.display = visibleRows.length === 0 ? "" : "none";
}
updateInterfaces();
setInterval(updateInterfaces, 10000);

document.getElementById("status-filter")
    .addEventListener("change", filterInterfaces);

document
    .getElementById("interface-search")
    .addEventListener("input", filterInterfaces);
