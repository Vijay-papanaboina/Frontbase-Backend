import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  const token = req.cookies.jwt;
  console.log("Auth middleware triggered.");

  if (!token) {
    console.warn("Authentication failed: No token provided in cookies.");
    return res
      .status(401)
      .json({ message: "Authentication failed: No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log("Token verified successfully for user:", decoded.userId);
    next();
  } catch (error) {
    console.error("Authentication failed: Invalid token.", error);
    res.clearCookie("jwt");
    return res
      .status(401)
      .json({ message: "Authentication failed: Invalid token." });
  }
};

export default authMiddleware;
