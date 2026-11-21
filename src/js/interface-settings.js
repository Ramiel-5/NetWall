document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("interface-settings-form");
    const ipv4Type = document.getElementById("ipv4Type");
    const staticFields = document.getElementById("static-ipv4-fields");

    if (!form || !ipv4Type || !staticFields) {
        console.error("Interface Settings: Required elements not found.");
        return;
    }

    // Show or hide Static IPv4 configuration fields
    function updateIpv4Fields() {
        const isStatic = ipv4Type.value === "static";

        staticFields.hidden = !isStatic;
        staticFields.style.display = isStatic ? "block" : "none";

        const inputs = staticFields.querySelectorAll("input");

        inputs.forEach(input => {
            input.disabled = !isStatic;
            input.required =
                isStatic && input.name !== "ipv4Gateway";
        });

        console.log(
            `IPv4 configuration: ${ipv4Type.value}, Static fields visible: ${isStatic}`
        );
    }

    // Update whenever configuration type changes
    ipv4Type.addEventListener("change", updateIpv4Fields);

    // Initialize when page loads
    updateIpv4Fields();

    // Save settings
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const status = document.getElementById(
            "interface-settings-status"
        );

        const saveButton = form.querySelector(
            'button[type="submit"]'
        );

        const interfaceId = form.dataset.interfaceId;

        status.textContent = "Saving settings...";
        status.className = "interface-settings-status";

        saveButton.disabled = true;

        const formData = new FormData(form);

        const payload = {
            enabled: document.getElementById("enabled").checked,
            name: formData.get("name"),
            ipv4Type: formData.get("ipv4Type"),
            ipv4Address: formData.get("ipv4Address") || "",
            ipv4Prefix: formData.get("ipv4Prefix") || "",
            ipv4Gateway: formData.get("ipv4Gateway") || "",
            macAddress: formData.get("macAddress") || "",
            mtu: formData.get("mtu") || "",
            mss: formData.get("mss") || "",
            speedDuplex: formData.get("speedDuplex") || "auto"
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
                    "Unable to save settings"
                );
            }

            status.textContent = result.message;
            status.classList.add("success");

        } catch (error) {
            console.error(error);

            status.textContent = error.message;
            status.classList.add("error");

        } finally {
            saveButton.disabled = false;
        }
    });
});