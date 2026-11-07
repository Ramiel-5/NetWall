const tableBody = document.getElementById("arp-table-body");
const arpCount = document.getElementById("arp-count");
const arpStatus = document.getElementById("arp-status");
const refreshButton = document.getElementById("refresh-button");

async function loadArpTable() {
    refreshButton.disabled = true;
    arpStatus.textContent = "Loading ARP table...";

    try {
        const response = await fetch("/arp/data");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to load ARP table");
        }

        tableBody.replaceChildren();

        if (data.entries.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 4;
            cell.textContent = "No dynamic ARP entries found.";
        }

        data.entries.forEach(entry => {
            const row = tableBody.insertRow();

            row.insertCell().textContent = entry.ip;
            row.insertCell().textContent = entry.mac;
            row.insertCell().textContent = entry.interface;
            row.insertCell().textContent = entry.state;
        });

        arpCount.textContent = data.entries.length;
        arpStatus.textContent = "ARP table updated successfully.";

    } catch (error) {
        arpStatus.textContent = error.message;

    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener("click", loadArpTable);

loadArpTable();