//Definition
const express = require("express");
const app = express();
const PORT = 3000;
const dashboardRouter = require("./routes/dashboard");
const routesRouter = require("./routes/routes");
const interfacesRouter = require("./routes/interfaces");
const firewallRouter = require("./routes/firewall");
const arpRouter = require("./routes/arp");

const logRouter = require("./routes/logs");

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.json());
app.use(express.static("src"));
app.use(express.urlencoded({ extended: false }));
app.use("/", dashboardRouter);
app.use("/routes", routesRouter);
app.use("/interfaces",interfacesRouter);
app.use("/logs", logRouter);
app.use("/firewall", firewallRouter);
app.use("/arp",arpRouter);
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
