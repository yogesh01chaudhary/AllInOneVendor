const jwt = require("jsonwebtoken");

exports.auth = async (req, res, next) => {
  try {
    let token = req.headers.authorization || req.headers["x-access-token"];
    if (!token) {
      return res
        .status(499)
        .send({ success: false, message: "Token not found" });
    }
    token = token.split(" ")[1];
    let data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: data.id };
    next();
  } catch (e) {
    return res.status(500).send({ success: false, error: e.name });
  }
};

const { TokenExpiredError } = jwt;

const catchError = (err, res) => {
  if (err instanceof TokenExpiredError) {
    return res
      .status(401)
      .send({ message: "Unauthorized! Access Token was expired!" });
  }

  return res.status(401).send({ message: "Unauthorized!" });
};

exports.verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"] || req.headers.authorization;

  if (!token) {
    return res.status(403).send({ message: "No token provided!" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return catchError(err, res);
    }
    req.user = { id: decoded.id };
    next();
  });
};
