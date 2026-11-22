const rows = document.getElementById("assignment-rows");
const addButton = document.getElementById("add-button");
const saveButton = document.getElementById("save-button");
const statusElement = document.getElementById("status");

// Physical interfaces from Ubuntu
let networkInterfaces = {};

// Logical interfaces from NetWall
let interfaces = [];

// Show status
function showStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.className = type;
}

// API request
async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

// Load physical interfaces
async function loadNetworkInterfaces() {
    const data = await apiRequest("/interfaces/ports");

    networkInterfaces = data.interfaces || {};
}

// Load logical interfaces
async function loadAssignments() {
    const data = await apiRequest("/interfaces/assignments");

    interfaces = data.assignments || [];

    renderAssignments();
}

// Get next logical interface ID
function getNextInterfaceId() {

    // Restore LAN if it does not exist
    const hasLAN = interfaces.some(
        item => item.id === "LAN"
    );

    if (!hasLAN) {
        return "LAN";
    }

    // Find smallest available OPT ID
    let number = 1;

    while (
        interfaces.some(item => item.id === `OPT${number}`)
    ) {
        number++;
    }

    return `OPT${number}`;
}

// Update Add button
function updateAddButton() {
    const physicalCount = Object.keys(networkInterfaces).length;
    const logicalCount = interfaces.length;

    addButton.disabled = logicalCount >= physicalCount;
}

// Render assignments
function renderAssignments() {
    rows.replaceChildren();

    interfaces.forEach((item, index) => {

        const tr = document.createElement("tr");

        // Interface ID
        const interfaceCell = document.createElement("td");

        interfaceCell.textContent = item.id;

        // Description
        const nameCell = document.createElement("td");

        const nameInput = document.createElement("input");

        nameInput.type = "text";
        nameInput.value = item.name;
        nameInput.maxLength = 40;

        nameInput.addEventListener("input", () => {
            interfaces[index].name = nameInput.value;
        });

        nameCell.appendChild(nameInput);

        // Physical Network Port
        const portCell = document.createElement("td");

        const select = document.createElement("select");

        select.className = "interface-select";

        // Empty option
        const emptyOption = document.createElement("option");

        emptyOption.value = "";
        emptyOption.textContent = "-- Select Network Port --";

        select.appendChild(emptyOption);

        // Available physical NICs
        Object.keys(networkInterfaces).forEach(nic => {

            const option = document.createElement("option");

            option.value = nic;
            option.textContent = nic;

            select.appendChild(option);
        });

        // Restore previously selected NIC
        select.value = item.nic || "";

        // Update NIC selection
        select.addEventListener("change", () => {
            interfaces[index].nic = select.value;
        });

        portCell.appendChild(select);

        // Action
        const actionCell = document.createElement("td");

        // WAN cannot be deleted
        if (item.id !== "WAN") {

            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", () => {
                deleteInterface(item.id);
            });

            actionCell.appendChild(deleteButton);
        }

        tr.append(
            interfaceCell,
            nameCell,
            portCell,
            actionCell
        );

        rows.appendChild(tr);
    });

    // Update Add button
    updateAddButton();
}

// Add logical interface
function addInterface() {

    const physicalCount = Object.keys(networkInterfaces).length;

    if (interfaces.length >= physicalCount) {

        showStatus(
            "Maximum number of logical interfaces reached.",
            "error"
        );

        return;
    }

    const id = getNextInterfaceId();

    interfaces.push({
        id: id,
        name: id,
        nic: ""
    });

    renderAssignments();

    showStatus(`${id} interface added.`, "success");
}

// Delete logical interface
function deleteInterface(id) {

    // Protect WAN
    if (id === "WAN") {
        return;
    }

    interfaces = interfaces.filter(
        item => item.id !== id
    );

    renderAssignments();

    showStatus(`${id} interface deleted.`, "success");
}

// Validate duplicate physical NICs before saving
function validateAssignments() {

    const selectedNics = interfaces
        .map(item => item.nic)
        .filter(nic => nic !== "");

    const duplicatedNics = selectedNics.filter(
        (nic, index) => selectedNics.indexOf(nic) !== index
    );

    if (duplicatedNics.length > 0) {

        return {
            valid: false,
            message: `Physical interface ${duplicatedNics[0]} is assigned more than once.`
        };
    }

    return {
        valid: true
    };
}

// Save assignments
async function saveAssignments() {

    // Validate before sending request
    const validation = validateAssignments();

    if (!validation.valid) {

        showStatus(validation.message, "error");

        return;
    }

    try {

        saveButton.disabled = true;

        showStatus("Saving assignments...");

        const data = await apiRequest(
            "/interfaces/assignments",
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    interfaces
                })
            }
        );

        showStatus(
            data.message || "Assignments saved successfully.",
            "success"
        );

    } catch (error) {

        showStatus(error.message, "error");

    } finally {

        saveButton.disabled = false;
    }
}

// Event listeners
addButton.addEventListener("click", addInterface);

saveButton.addEventListener("click", saveAssignments);

// Initialize
async function initialize() {

    try {

        addButton.disabled = true;
        saveButton.disabled = true;

        await loadNetworkInterfaces();

        await loadAssignments();

    } catch (error) {

        showStatus(error.message, "error");

    } finally {

        updateAddButton();

        saveButton.disabled = false;
    }
}

initialize();