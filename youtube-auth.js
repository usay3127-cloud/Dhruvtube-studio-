const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required."
  );
}

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://127.0.0.1:3000/api/youtube/oauth2callback";

const TOKEN_DIR = path.join(__dirname, ".youtube-tokens");

if (!fs.existsSync(TOKEN_DIR)) {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
}

const oauth2Client = createOAuthClient();

function tokenPath(userId) {
  return path.join(
    TOKEN_DIR,
    `user-${String(userId)}.json`
  );
}

function getAuthUrl(state = "") {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    state,
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
  });
}

function saveToken(userId, tokens) {
  if (!userId) {
    throw new Error("userId is required");
  }

  fs.writeFileSync(
    tokenPath(userId),
    JSON.stringify(tokens, null, 2)
  );
}

function loadToken(userId) {
  if (!userId) return null;

  const file = tokenPath(userId);

  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    return null;
  }
}

function getOAuthClient(userId) {
  const client = createOAuthClient();
  const token = loadToken(userId);

  if (!token) {
    return null;
  }

  client.setCredentials(token);

  return client;
}

function deleteToken(userId) {
  if (!userId) return false;

  const file = tokenPath(userId);

  if (!fs.existsSync(file)) {
    return false;
  }

  fs.unlinkSync(file);
  return true;
}

module.exports = {
  oauth2Client,
  createOAuthClient,
  getAuthUrl,
  saveToken,
  loadToken,
  getOAuthClient,
  deleteToken,
  TOKEN_DIR
};
