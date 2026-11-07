
let currentAssignments = [];
let availableNics = {};

// Load data
async function loadInterfaces() {
    try {
        const [portsResponse, assignmentsResponse] = await Promise.all([
            fetch("/interfaces/ports"),
            fetch("/interfaces/assignments")
        ]);

        if (!portsResponse.ok || !assignmentsResponse.ok) {
            throw new Error("Failed to load interface data");
        }

        const portsData = await portsResponse.json();
        const assignmentsData = await assignmentsResponse.json();

        availableNics = portsData.interfaces;
        currentAssignments = assignmentsData.assignments;

        renderInterfaces();

    } catch (error) {
        console.error("Load interfaces error:", error);
    }
}

// Update Add button
function updateAddButton() {
    const addButton = document.getElementById("add-button");

    const maxInterfaces = Object.keys(availableNics).length;

    addButton.disabled =
        currentAssignments.length >= maxInterfaces;
}

// Render interfaces
function renderInterfaces() {
    const tbody = document.getElementById("assignment-rows");

    tbody.replaceChildren();

    currentAssignments.forEach(item => {
        const row = document.createElement("tr");

        const interfaceCell = document.createElement("td");
        const portCell = document.createElement("td");
        const actionCell = document.createElement("td");

        // Interface name
        const interfaceLink = document.createElement("a");

        interfaceLink.textContent = item.name;
        interfaceLink.href = `/interfaces/settings/${item.id}`;

        interfaceCell.appendChild(interfaceLink);

        // NIC dropdown
        const select = document.createElement("select");

        select.className = "nic-select";

        const defaultOption = document.createElement("option");

        defaultOption.value = "";
        defaultOption.textContent = "-- Select NIC --";

        select.appendChild(defaultOption);

        Object.keys(availableNics).forEach(nicName => {
            const option = document.createElement("option");

            option.value = nicName;
            option.textContent = nicName;
            option.selected = item.nic === nicName;

            select.appendChild(option);
        });

        select.addEventListener("change", () => {
            item.nic = select.value;
            renderInterfaces();
        });

        portCell.appendChild(select);

        // Delete button: WAN cannot be deleted
        if (item.id !== "WAN") {
            const deleteButton = document.createElement("button");

            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", () => {
                if (!confirm(`Delete interface ${item.name}?`)) {
                    return;
                }

                currentAssignments = currentAssignments.filter(
                    other => other.id !== item.id
                );

                renderInterfaces();
            });

            actionCell.appendChild(deleteButton);
        }

        row.append(interfaceCell, portCell, actionCell);

        tbody.appendChild(row);
    });

    updateAddButton();
}

// Add logical interface
document.getElementById("add-button").addEventListener("click", () => {
    const maxInterfaces = Object.keys(availableNics).length;

    if (currentAssignments.length >= maxInterfaces) {
        return;
    }

    const usedIds = currentAssignments.map(item => item.id);

    let number = 1;

    while (usedIds.includes(`OPT${number}`)) {
        number++;
    }

    currentAssignments.push({
        id: `OPT${number}`,
        name: `OPT${number}`,
        nic: ""
    });

    renderInterfaces();
});

// Save assignments
document.getElementById("save-button").addEventListener("click", async () => {
    try {
        // Check duplicate NICs
        const assignedNics = currentAssignments
            .map(item => item.nic)
            .filter(nic => nic !== "");

        if (new Set(assignedNics).size !== assignedNics.length) {
            throw new Error(
                "A NIC cannot be assigned to multiple logical interfaces."
            );
        }

        // Check WAN existence
        if (!currentAssignments.some(item => item.id === "WAN")) {
            throw new Error("WAN interface cannot be deleted.");
        }

        // Save data
        const response = await fetch("/interfaces/assignments", {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                interfaces: currentAssignments
            })
        });

        if (!response.ok) {
            const result = await response.json();

            throw new Error(
                result.error || "Failed to save assignments"
            );
        }

        document.getElementById("status").textContent =
            "Saved successfully.";

    } catch (error) {
        console.error("Save error:", error);

        document.getElementById("status").textContent =
            error.message;
    }
});

// Initial load
loadInterfaces();
