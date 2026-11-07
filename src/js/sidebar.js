async function loadLogicalInterfaces() {
    const container = document.getElementById("logical-interface-list");
    const assignmentLink = document.getElementById("assignment-link");

    try {
        const response = await fetch("/interfaces/assignments");

        if (!response.ok) {
            throw new Error("Failed to load logical interfaces");
        }

        const data = await response.json();

        container.replaceChildren();

        const currentPath = window.location.pathname;

        // Update Assignment active state
        assignmentLink.classList.toggle(
            "active",
            currentPath === "/interfaces"
        );

        // Display all logical interfaces
        data.assignments.forEach(item => {
            const link = document.createElement("a");

            link.href = `/interfaces/settings/${encodeURIComponent(item.id)}`;
            link.className = "sidebar-link sidebar-interface-link";
            link.textContent = item.name;

            // Highlight current interface
            if (currentPath === link.pathname) {
                link.classList.add("active");
            }

            container.appendChild(link);
        });

    } catch (error) {
        console.error("Load logical interfaces error:", error);
    }
}

loadLogicalInterfaces();