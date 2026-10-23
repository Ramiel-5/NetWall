//Definition
const express = require("express");
const app = express();
const PORT = 3000;
const dashboardRouter = require("./routes/dashboard");
const routingRouter = require("./routes/routing");
const interfacesRouter = require("./routes/interfaces");
const firewallRouter = require("./routes/firewall");
const diagnosticsRouter = require("./routes/diagnostics");
const logRouter = require("./routes/log");

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("src"));
app.use("/", dashboardRouter);
app.use("/routes", routingRouter);
app.use("/interfaces", interfacesRouter);
app.use("/log", logRouter);
app.use("/firewall", firewallRouter);
app.use("/diagnostics", diagnosticsRouter);
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});