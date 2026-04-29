import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user (Farmer by default)
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "Farmer"
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @route   GET /api/auth/github
// @desc    Redirect to GitHub OAuth
router.get("/github", (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&scope=user:email`;
  res.redirect(url);
});

// @route   GET /api/auth/github/callback
// @desc    GitHub OAuth callback
router.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.redirect("/login.html?error=github_auth_failed");
    }

    // 2. Fetch user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const userData = await userRes.json();

    // 3. Fetch user emails (since primary email might be private)
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find((e) => e.primary && e.verified)?.email || emails[0].email;

    // 4. Find or Create User
    let user = await User.findOne({ $or: [{ githubId: userData.id.toString() }, { email: primaryEmail }] });

    if (!user) {
      user = new User({
        name: userData.name || userData.login,
        email: primaryEmail,
        githubId: userData.id.toString(),
        role: "Farmer", // Default role
      });
      await user.save();
    } else if (!user.githubId) {
      // Link existing account if email matches
      user.githubId = userData.id.toString();
      await user.save();
    }

    // 5. Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    // 6. Redirect to success page with token
    const redirectUrl = `/oauth-success.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }))}`;
    
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("GitHub Auth Error:", err);
    res.redirect("/login.html?error=server_error");
  }
});

export default router;
