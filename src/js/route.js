document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("route-table-body");
    const routeCount = document.getElementById("route-count");
    const routeStatus = document.getElementById("route-status");

    async function loadRoutes() {
        try {
            const response = await fetch("/routes/data");
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Unable to load routing table");
            }

            renderRoutes(data.routes);

        } catch (error) {
            console.error("Routing Table Error:", error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">Failed to load routing table.</td>
                </tr>
            `;

            routeStatus.textContent = error.message;
        }
    }

    function renderRoutes(routes) {
        tableBody.innerHTML = "";

        if (!Array.isArray(routes) || routes.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">No routing entries found.</td>
                </tr>
            `;

            routeCount.textContent = "0";
            return;
        }

        routes.forEach(route => {
            const row = document.createElement("tr");

            const values = [
                route.destination,
                route.gateway,
                route.flags,
                route.use,
                route.mtu,
                route.netif,
                route.expire
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        routeCount.textContent = routes.length;
        routeStatus.textContent = "";
    }

    loadRoutes();
});