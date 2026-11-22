document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("interface-settings-form");

    const ipv4Type = document.getElementById("ipv4Type");
    const staticFields = document.getElementById("static-ipv4-fields");

    const status = document.getElementById("interface-settings-status");

    const saveButton = form?.querySelector('button[type="submit"]');

    if (!form || !ipv4Type || !staticFields || !status) {
        console.error("Interface Settings: Required elements not found.");
        return;
    }

    // Elements
    const enabledInput = document.getElementById("enabled");
    const nameInput = document.getElementById("name");

    const ipv4AddressInput = document.getElementById("ipv4Address");
    const ipv4PrefixInput = document.getElementById("ipv4Prefix");
    const ipv4GatewayInput = document.getElementById("ipv4Gateway");

    const mtuInput = document.getElementById("mtu");

    const dhcp6Input = document.getElementById("dhcp6");
    const acceptRaInput = document.getElementById("acceptRa");

    const dnsInput = document.getElementById("dns");

    // Show or hide Static IPv4 fields
    function updateIpv4Fields() {
        const isStatic = ipv4Type.value === "static";

        staticFields.hidden = !isStatic;

        const inputs = staticFields.querySelectorAll("input");

        inputs.forEach(input => {
            input.disabled = !isStatic;

            input.required =
                isStatic && input.name !== "ipv4Gateway";
        });
    }

    ipv4Type.addEventListener("change", updateIpv4Fields);

    updateIpv4Fields();

    // Parse DNS servers
    function getDnsServers() {
        if (!dnsInput) {
            return [];
        }

        return dnsInput.value
            .split(/[\n,]+/)
            .map(address => address.trim())
            .filter(Boolean);
    }

    // Display status
    function showStatus(message, type = "") {
        status.textContent = message;
        status.className = `interface-settings-status ${type}`;
    }

    // Save interface settings
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const interfaceId = form.dataset.interfaceId;

        if (!interfaceId) {
            showStatus("Interface ID is missing.", "error");
            return;
        }

        const payload = {
            enabled: enabledInput.checked,

            name: nameInput.value.trim(),

            ipv4Type: ipv4Type.value,

            ipv4Address: ipv4AddressInput?.value.trim() || "",

            ipv4Prefix: ipv4PrefixInput?.value || "",

            ipv4Gateway: ipv4GatewayInput?.value.trim() || "",

            mtu: mtuInput?.value || "",

            // IPv6
            dhcp6: dhcp6Input?.checked || false,

            acceptRa: acceptRaInput?.checked || false,

            // DNS
            dns: getDnsServers()
        };

        showStatus("Saving settings...");

        if (saveButton) {
            saveButton.disabled = true;
        }

        try {
            const response = await fetch(
                `/interfaces/settings/${encodeURIComponent(interfaceId)}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    result.message ||
                    "Unable to save interface settings."
                );
            }

            showStatus(
                result.message || "Settings saved successfully.",
                "success"
            );

        } catch (error) {
            console.error("Interface Settings Error:", error);

            showStatus(error.message, "error");

        } finally {
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    });
});