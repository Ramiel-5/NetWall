
let isUpdating = false;
async function updateRoutingTable() {
    if (isUpdating) return;

    isUpdating = true;
    const refreshButton = document.getElementById("refresh-button");
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    try {
        const response = await fetch("/routing/data");

        if (!response.ok) {
            throw new Error("Failed to fetch ");
        }

        const table = await response.json();
        const total = table.length;


        const tbody = document.getElementById("route-list");
        const statusText = document.getElementById("update-status");
        statusText.textContent = "Updating...";
        const currentRows = new Map(
            [...tbody.querySelectorAll("tr[data-routing]")].map(row => [
                row.dataset.route,
                row
            ])
        );
        statusText.textContent =
            `Connected · Last updated: ${new Date().toLocaleTimeString()}`;
        statusText.className = "connected";
        filterInterfaces();
        interfaces.forEach(item => {
            let row = currentRows.get(route.Iface);

            if (!row) {
                row = document.createElement("tr");
                row.dataset.route = route.Iface;

                const nameCell = document.createElement("td");
                nameCell.textContent = route.Iface;

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

            currentRows.delete(route.Iface);
        });

        currentRows.forEach(row => row.remove());

    } catch (error) {

        console.error("Failed to update routing table:", error);

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


updateRoutingTable();
setInterval(updateInterfaces, 10000);
