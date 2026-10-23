//Definition
const express = require("express");
const app = express();
const PORT = 3000;
const dashboardRouter = require("./routes/dashboard");
const routingRouter = require("./routes/routing");
const interfacesRouter = require("./routes/interfaces");

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("src"));
app.use("/", dashboardRouter);
app.use("/routes", routingRouter);
app.use("/interfaces", interfacesRouter);
//Main

// app.get("/", (req, res) => {
//     res.render("dashboard");
// })


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});