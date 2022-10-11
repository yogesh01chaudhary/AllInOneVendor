const express = require("express");
const app = express();
require("dotenv/config");
const router=require("./routes/vendor")
const {connect}=require("./connection/dbConnection")
const PORT=process.env.PORT
app.use(express.json())
app.use(router)
connect()
app.get("/", (req, res) => {
  console.log({ success: true, message: "All In One Vendor Home" });
  res.status(200).send({ success: true, message: "All In One Vendor Home" });
});

app.listen(PORT,()=>{
    console.log(`Server running on http://localhost:${PORT}`)
})

