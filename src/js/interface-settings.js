document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("interface-settings-form");
    const ipv4Type = document.getElementById("ipv4Type");
    const staticFields = document.getElementById("static-ipv4-fields");
    const status = document.getElementById("interface-settings-status");

    if (!form || !ipv4Type || !staticFields || !status) {
        console.error("Interface Settings: Required elements not found.");
        return;
    }

    const saveButton = form.querySelector('button[type="submit"]');

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

    // Listen for IPv4 configuration changes
    ipv4Type.addEventListener("change", updateIpv4Fields);

    // Initialize form
    updateIpv4Fields();

    // Save interface settings
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const interfaceId = form.dataset.interfaceId;

        if (!interfaceId) {
            status.textContent = "Interface ID is missing.";
            status.className = "interface-settings-status error";
            return;
        }

        status.textContent = "Saving settings...";
        status.className = "interface-settings-status";

        if (saveButton) {
            saveButton.disabled = true;
        }

        const formData = new FormData(form);

        const payload = {
            enabled: document.getElementById("enabled").checked,

            name: formData.get("name"),

            ipv4Type: formData.get("ipv4Type"),

            ipv4Address: formData.get("ipv4Address") || "",

            ipv4Prefix: formData.get("ipv4Prefix") || "",

            ipv4Gateway: formData.get("ipv4Gateway") || "",

            mtu: formData.get("mtu") || ""
        };

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

            status.textContent =
                result.message || "Settings saved successfully.";

            status.className = "interface-settings-status success";

        } catch (error) {
            console.error("Interface Settings Error:", error);

            status.textContent = error.message;

            status.className = "interface-settings-status error";

        } finally {
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    });
});