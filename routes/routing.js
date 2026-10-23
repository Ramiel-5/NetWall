const express = require("express");
const router = express.Router();
const interfaceService = require("../services/interfaceService");

router.get("/", async (req, res) => {
    res.renderer("routing",{
	activePage:"routing"
	})
});

module.exports = router;
