const express = require("express");
const router = express.Router();
const getInterfaceStatus = require("../services/interfaceService");
router.get("/", async (req, res) => {
	try {
		const interfaces = await getInterfaceStatus();
		res.render("interfaces", {
			interfaces,
			activePage: "interfaces"
		});

	} catch (error) {
		console.error("Failed to get interface statuses:", error.message);
		res.status(500).json({
			error: "Failed to retrieve interface statuses"
		});
	}
});
router.get("/data", async (req, res) => {
	try {
		const data = await getInterfaceStatus();
		res.json(data);
	} catch (error) {
		console.error("Failed to get interface statuses:", error.message);
		res.status(500).json({
			error: "Failed to retrieve interface statuses"
		});
	}
});



module.exports = router;
