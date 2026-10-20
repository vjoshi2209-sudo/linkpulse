const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// In-memory storage
const links = new Map();

app.use(cors());
app.use(express.json());

// Generate a unique short code
function createCode() {
  let code;

  do {
    code = crypto.randomBytes(4).toString("hex").slice(0, 6);
  } while (links.has(code));

  return code;
}

// Check whether a link has expired
function isExpired(link) {
  return (
    link.expiresAt &&
    Date.now() >= new Date(link.expiresAt).getTime()
  );
}

// Build the short URL
function getShortUrl(req, code) {
  return `${req.protocol}://${req.get("host")}/${code}`;
}

// Test the server
app.get("/", (req, res) => {
  res.send("LINKPULSE server is running!");
});

// Create a short link
app.post("/api/shorten", (req, res) => {
  const { url, expiresAt } = req.body;

  if (!url || !expiresAt) {
    return res.status(400).json({
      error: "Please provide a URL and expiry date/time.",
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      error: "Please enter a valid URL.",
    });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({
      error: "Only HTTP and HTTPS URLs are allowed.",
    });
  }

  const expiryDate = new Date(expiresAt);

  if (Number.isNaN(expiryDate.getTime())) {
    return res.status(400).json({
      error: "Invalid expiry date/time.",
    });
  }

  if (expiryDate.getTime() <= Date.now()) {
    return res.status(400).json({
      error: "Expiry date/time must be in the future.",
    });
  }

  const code = createCode();

  const link = {
    code,
    originalUrl: parsedUrl.toString(),
    clicks: 0,
    createdAt: new Date().toISOString(),
    expiresAt: expiryDate.toISOString(),
  };

  links.set(code, link);

  res.status(201).json({
    code,
    shortUrl: getShortUrl(req, code),
    originalUrl: link.originalUrl,
    clicks: link.clicks,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    status: "Active",
  });
});

// Get all links for the dashboard
app.get("/api/links", (req, res) => {
  const allLinks = Array.from(links.values()).map((link) => ({
    code: link.code,
    shortUrl: getShortUrl(req, link.code),
    originalUrl: link.originalUrl,
    clicks: link.clicks,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    status: isExpired(link) ? "Expired" : "Active",
  }));

  res.json(allLinks);
});

// Get analytics for a short link
app.get("/api/analytics/:code", (req, res) => {
  const link = links.get(req.params.code);

  if (!link) {
    return res.status(404).json({
      error: "Short link not found.",
    });
  }

  res.json({
    code: link.code,
    originalUrl: link.originalUrl,
    clicks: link.clicks,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    status: isExpired(link) ? "Expired" : "Active",
  });
});

// Redirect short links
app.get("/:code", (req, res) => {
  const link = links.get(req.params.code);

  if (!link) {
    return res.status(404).send("Short link not found.");
  }

  if (isExpired(link)) {
    return res.status(410).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Link Expired | LINKPULSE</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #080d20;
              color: #f5f7ff;
              font-family: Arial, sans-serif;
            }
            main {
              max-width: 420px;
              margin: 24px;
              padding: 36px;
              text-align: center;
              border: 1px solid #29365d;
              border-radius: 20px;
              background: #101832;
            }
            h1 { color: #8d9cff; }
            p { color: #c3cbe0; line-height: 1.6; }
          </style>
        </head>
        <body>
          <main>
            <h1>Link expired</h1>
            <p>This LINKPULSE short link has passed its expiry date and time.</p>
            <p>Please contact the person who shared it for a new link.</p>
          </main>
        </body>
      </html>
    `);
  }

  // Count only successful, active-link redirects
  link.clicks += 1;

  return res.redirect(302, link.originalUrl);
});

// Start the server
app.listen(PORT, () => {
  console.log(`LINKPULSE server running at http://localhost:${PORT}`);
});