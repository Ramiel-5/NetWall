(() => {
    const tableBody = document.getElementById("firewall-rule-body");
    const ruleCount = document.getElementById("rule-count");
    const statusText = document.getElementById("firewall-status");
    const modal = document.getElementById("rule-modal");
    const form = document.getElementById("firewall-rule-form");
    const addButton = document.getElementById("add-rule-btn");
    const applyButton = document.getElementById("apply-rules-btn");
    const closeButton = document.getElementById("close-modal-btn");
    const cancelButton = document.getElementById("cancel-rule-btn");
    const modalTitle = document.getElementById("modal-title");
    const saveButton = document.getElementById("save-rule-btn");

    let firewallRules = [];
    let busy = false;

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, options);
        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch {
            throw new Error(`Server returned an invalid response (${response.status})`);
        }
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }
        return data;
    }

    function setStatus(message, isError = false) {
        statusText.textContent = message || "";
        statusText.classList.toggle("error", isError);
    }

    function setBusy(value) {
        busy = value;
        addButton.disabled = value;
        applyButton.disabled = value;
        saveButton.disabled = value;
    }

    function addCell(row, value) {
        const cell = row.insertCell();
        cell.textContent = value;
        return cell;
    }

    function makeActionButton(label, className, handler, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `rule-action-button ${className || ""}`.trim();
        button.textContent = label;
        button.disabled = disabled || busy;
        button.addEventListener("click", handler);
        return button;
    }

    async function loadFirewallRules() {
        try {
            setStatus("Loading firewall rules...");
            const data = await apiRequest("/firewall/data");
            firewallRules = Array.isArray(data.rules) ? data.rules : [];
            firewallRules.sort((a, b) => a.position - b.position);
            renderFirewallRules();
            setStatus("");
        } catch (error) {
            firewallRules = [];
            ruleCount.textContent = "0";
            tableBody.replaceChildren();
            const row = tableBody.insertRow();
            addCell(row, error.message).colSpan = 11;
            setStatus(error.message, true);
        }
    }

    function renderFirewallRules() {
        tableBody.replaceChildren();
        ruleCount.textContent = String(firewallRules.length);

        if (firewallRules.length === 0) {
            const row = tableBody.insertRow();
            addCell(row, "No firewall rules configured.").colSpan = 11;
            return;
        }

        firewallRules.forEach((rule, index) => {
            const row = tableBody.insertRow();
            if (!rule.enabled) row.classList.add("disabled-rule");

            addCell(row, index + 1);
            addCell(row, rule.interface);
            addCell(row, ({ ACCEPT: "PASS", DROP: "BLOCK", REJECT: "REJECT" })[rule.action] || rule.action);
            addCell(row, String(rule.protocol || "all").toUpperCase());
            addCell(row, rule.source || "Any");
            addCell(row, rule.sourcePort || "Any");
            addCell(row, rule.destination || "Any");
            addCell(row, rule.destinationPort || "Any");
            addCell(row, rule.description || "-");

            const statusCell = row.insertCell();
            const badge = document.createElement("span");
            badge.className = `rule-status ${rule.enabled ? "enabled" : "disabled"}`;
            badge.textContent = rule.enabled ? "Enabled" : "Disabled";
            statusCell.appendChild(badge);

            const actionsCell = row.insertCell();
            const actions = document.createElement("div");
            actions.className = "rule-actions";
            actions.append(
                makeActionButton("↑", "", () => moveRule(index, -1), index === 0),
                makeActionButton("↓", "", () => moveRule(index, 1), index === firewallRules.length - 1),
                makeActionButton("Edit", "", () => openEditModal(rule)),
                makeActionButton(rule.enabled ? "Disable" : "Enable", "", () => toggleRule(rule.id)),
                makeActionButton("Delete", "danger", () => deleteRule(rule.id))
            );
            actionsCell.appendChild(actions);
        });
    }

    function openAddModal() {
        form.reset();
        document.getElementById("rule-id").value = "";
        modalTitle.textContent = "Add Firewall Rule";
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.getElementById("interface").focus();
    }

    function openEditModal(rule) {
        form.reset();
        document.getElementById("rule-id").value = rule.id;
        document.getElementById("interface").value = rule.interface;
        document.getElementById("action").value = rule.action;
        document.getElementById("protocol").value = rule.protocol;
        document.getElementById("source").value = rule.source || "";
        document.getElementById("source-port").value = rule.sourcePort || "";
        document.getElementById("destination").value = rule.destination || "";
        document.getElementById("destination-port").value = rule.destinationPort || "";
        document.getElementById("description").value = rule.description || "";
        modalTitle.textContent = "Edit Firewall Rule";
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        form.reset();
    }

    async function saveRule(event) {
        event.preventDefault();
        if (busy) return;

        const id = document.getElementById("rule-id").value;
        const rule = {
            interface: document.getElementById("interface").value,
            action: document.getElementById("action").value,
            protocol: document.getElementById("protocol").value,
            source: document.getElementById("source").value.trim(),
            sourcePort: document.getElementById("source-port").value,
            destination: document.getElementById("destination").value.trim(),
            destinationPort: document.getElementById("destination-port").value,
            description: document.getElementById("description").value.trim()
        };

        setBusy(true);
        try {
            const result = await apiRequest(
                id ? `/firewall/${encodeURIComponent(id)}` : "/firewall",
                {
                    method: id ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rule)
                }
            );
            closeModal();
            await loadFirewallRules();
            setStatus(result.message);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        } finally {
            setBusy(false);
            renderFirewallRules();
        }
    }

    async function deleteRule(id) {
        if (busy || !confirm("Delete this firewall rule?")) return;
        setBusy(true);
        try {
            const result = await apiRequest(`/firewall/${encodeURIComponent(id)}`, { method: "DELETE" });
            await loadFirewallRules();
            setStatus(result.message);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        } finally {
            setBusy(false);
            renderFirewallRules();
        }
    }

    async function toggleRule(id) {
        if (busy) return;
        setBusy(true);
        try {
            const result = await apiRequest(`/firewall/${encodeURIComponent(id)}/toggle`, { method: "PATCH" });
            await loadFirewallRules();
            setStatus(result.message);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        } finally {
            setBusy(false);
            renderFirewallRules();
        }
    }

    async function moveRule(index, offset) {
        if (busy) return;
        const target = index + offset;
        if (target < 0 || target >= firewallRules.length) return;
        const reordered = [...firewallRules];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setBusy(true);
        try {
            const result = await apiRequest("/firewall/reorder", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered.map(rule => rule.id) })
            });
            firewallRules = result.rules || reordered;
            renderFirewallRules();
            setStatus(result.message);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        } finally {
            setBusy(false);
            renderFirewallRules();
        }
    }

    async function applyRules() {
        if (busy) return;
        setBusy(true);
        setStatus("Applying firewall rules...");
        try {
            const result = await apiRequest("/firewall/apply", { method: "POST" });
            setStatus(result.message);
        } catch (error) {
            setStatus(error.message, true);
            alert(error.message);
        } finally {
            setBusy(false);
            renderFirewallRules();
        }
    }

    addButton.addEventListener("click", openAddModal);
    applyButton.addEventListener("click", applyRules);
    closeButton.addEventListener("click", closeModal);
    cancelButton.addEventListener("click", closeModal);
    form.addEventListener("submit", saveRule);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal.classList.contains("active")) closeModal();
    });

    loadFirewallRules();
})();
