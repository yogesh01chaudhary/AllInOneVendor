const path=require("path")
const express = require("express");
const app = express();
require("dotenv/config");
const router = require("./routes/vendor");
const fileupload = require("express-fileupload");
const { connect } = require("./connection/dbConnection");
const PORT = process.env.PORT;
app.use(express.json());
app.use(fileupload());
app.use(express.static(path.join(__dirname,'public')))
app.use("/vendor", router);
connect();

app.get("/", (req, res) => {
  console.log({ success: true, message: "All In One Vendor Home" });
  res.status(200).send({ success: true, message: "All In One Vendor Home" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
