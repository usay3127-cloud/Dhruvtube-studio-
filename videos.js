const express = require("express");
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const router = express.Router();

const DB_FILE = path.join(__dirname, "dhruvtube.db");

async function openDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => require.resolve("sql.js/dist/" + file)
  });

  if (fs.existsSync(DB_FILE)) {
    return new SQL.Database(fs.readFileSync(DB_FILE));
  }

  return new SQL.Database();
}

function saveDatabase(db) {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}


// GET ALL VIDEOS
router.get("/videos", async (req, res) => {
  try {
    const db = await openDatabase();

    const result = db.exec(`
      SELECT
        id,
        user_id,
        title,
        description,
        filename,
        thumbnail,
        views,
        is_short,
        created_at
      FROM videos
      ORDER BY id DESC
    `);

    let videos = [];

    if (result.length > 0) {
      videos = result[0].values.map(row => ({
        id: row[0],
        user_id: row[1],
        title: row[2],
        description: row[3] || "",
        filename: row[4],
        url: "/uploads/" + row[4],
        thumbnail: row[5],
        views: row[6] || 0,
        is_short: row[7] || 0,
        created_at: row[8],
        channel: "DhruvTube User",
        type: row[7] ? "Shorts" : "Video",
        time: "Recently uploaded"
      }));
    }

    db.close();

    res.json({
      success: true,
      count: videos.length,
      videos
    });

  } catch (error) {
    console.error("Videos API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load videos.",
      error: error.message
    });
  }
});


// EDIT VIDEO — OWNER ONLY
router.put("/videos/:id", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = Number(req.body.user_id);

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Signed-in user required."
      });
    }

    const db = await openDatabase();

    const owner = db.exec(
      "SELECT user_id FROM videos WHERE id = ? LIMIT 1",
      [videoId]
    );

    if (!owner.length || !owner[0].values.length) {
      db.close();
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    if (Number(owner[0].values[0][0]) !== userId) {
      db.close();
      return res.status(403).json({
        success: false,
        message: "Only the video owner can edit this video."
      });
    }

    const title =
      typeof req.body.title === "string"
        ? req.body.title.trim()
        : "";

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    if (!title) {
      db.close();
      return res.status(400).json({
        success: false,
        message: "Title is required."
      });
    }

    db.run(
      `UPDATE videos
       SET title = ?, description = ?
       WHERE id = ? AND user_id = ?`,
      [title, description, videoId, userId]
    );

    saveDatabase(db);
    db.close();

    res.json({
      success: true,
      message: "Video updated successfully.",
      video_id: videoId
    });

  } catch (error) {
    console.error("Edit video error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update video.",
      error: error.message
    });
  }
});


// DELETE VIDEO — OWNER ONLY
router.delete("/videos/:id", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = Number(req.body.user_id);

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Signed-in user required."
      });
    }

    const db = await openDatabase();

    const result = db.exec(
      `SELECT filename, user_id
       FROM videos
       WHERE id = ?
       LIMIT 1`,
      [videoId]
    );

    if (!result.length || !result[0].values.length) {
      db.close();
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const filename = result[0].values[0][0];
    const ownerId = Number(result[0].values[0][1]);

    if (ownerId !== userId) {
      db.close();
      return res.status(403).json({
        success: false,
        message: "Only the video owner can delete this video."
      });
    }

    db.run("DELETE FROM likes WHERE video_id = ?", [videoId]);
    db.run("DELETE FROM videos WHERE id = ? AND user_id = ?", [
      videoId,
      userId
    ]);

    saveDatabase(db);
    db.close();

    const videoPath = path.join(__dirname, "uploads", filename);

    if (filename && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    res.json({
      success: true,
      message: "Video deleted successfully.",
      video_id: videoId
    });

  } catch (error) {
    console.error("Delete video error:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete video.",
      error: error.message
    });
  }
});


// ADD VIDEO VIEW
router.post("/videos/:id/view", async (req, res) => {
  try {
    const videoId = Number(req.params.id);

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    const db = await openDatabase();

    const result = db.exec(`
      SELECT views
      FROM videos
      WHERE id = ${videoId}
      LIMIT 1
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      db.close();

      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const currentViews = Number(result[0].values[0][0]) || 0;
    const newViews = currentViews + 1;

    db.run(
      "UPDATE videos SET views = ? WHERE id = ?",
      [newViews, videoId]
    );

    saveDatabase(db);
    db.close();

    res.json({
      success: true,
      video_id: videoId,
      views: newViews
    });

  } catch (error) {
    console.error("View API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update video views.",
      error: error.message
    });
  }
});


// LIKE VIDEO
router.post("/videos/:id/like", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = 1; // temporary user until login system is added

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    const db = await openDatabase();

    const video = db.exec(`
      SELECT id
      FROM videos
      WHERE id = ${videoId}
      LIMIT 1
    `);

    if (video.length === 0 || video[0].values.length === 0) {
      db.close();

      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const existing = db.exec(`
      SELECT user_id
      FROM likes
      WHERE user_id = ${userId}
      AND video_id = ${videoId}
      LIMIT 1
    `);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.close();

      return res.json({
        success: true,
        liked: true,
        message: "Already liked."
      });
    }

    db.run(
      "INSERT INTO likes (user_id, video_id) VALUES (?, ?)",
      [userId, videoId]
    );

    const countResult = db.exec(`
      SELECT COUNT(*)
      FROM likes
      WHERE video_id = ${videoId}
    `);

    const likes = Number(countResult[0].values[0][0]) || 0;

    saveDatabase(db);
    db.close();

    res.json({
      success: true,
      liked: true,
      likes
    });

  } catch (error) {
    console.error("Like API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not like video.",
      error: error.message
    });
  }
});


// UNLIKE VIDEO
router.delete("/videos/:id/like", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = 1; // temporary user until login system is added

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    const db = await openDatabase();

    db.run(
      "DELETE FROM likes WHERE user_id = ? AND video_id = ?",
      [userId, videoId]
    );

    const countResult = db.exec(`
      SELECT COUNT(*)
      FROM likes
      WHERE video_id = ${videoId}
    `);

    const likes = Number(countResult[0].values[0][0]) || 0;

    saveDatabase(db);
    db.close();

    res.json({
      success: true,
      liked: false,
      likes
    });

  } catch (error) {
    console.error("Unlike API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not unlike video.",
      error: error.message
    });
  }
});


// GET LIKE STATUS
router.get("/videos/:id/likes", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = 1;

    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid video ID."
      });
    }

    const db = await openDatabase();

    const countResult = db.exec(`
      SELECT COUNT(*)
      FROM likes
      WHERE video_id = ${videoId}
    `);

    const likedResult = db.exec(`
      SELECT user_id
      FROM likes
      WHERE user_id = ${userId}
      AND video_id = ${videoId}
      LIMIT 1
    `);

    const likes = Number(countResult[0].values[0][0]) || 0;
    const liked =
      likedResult.length > 0 &&
      likedResult[0].values.length > 0;

    db.close();

    res.json({
      success: true,
      likes,
      liked
    });

  } catch (error) {
    console.error("Likes API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load likes.",
      error: error.message
    });
  }
});


module.exports = router;


// EDIT VIDEO — OWNER ONLY
router.put("/videos/:id", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();

    if (!Number.isInteger(videoId) || !Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video or user ID."
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required."
      });
    }

    const db = await openDatabase();

    const result = db.exec(
      "SELECT user_id FROM videos WHERE id = ? LIMIT 1",
      [videoId]
    );

    if (!result.length || !result[0].values.length) {
      db.close();
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const ownerId = Number(result[0].values[0][0]);

    if (ownerId !== userId) {
      db.close();
      return res.status(403).json({
        success: false,
        message: "Only the video owner can edit this video."
      });
    }

    db.run(
      "UPDATE videos SET title = ?, description = ? WHERE id = ?",
      [title, description, videoId]
    );

    saveDatabase(db);
    db.close();

    res.json({
      success: true,
      message: "Video updated successfully."
    });

  } catch (error) {
    console.error("Edit video error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update video.",
      error: error.message
    });
  }
});


// DELETE VIDEO — OWNER ONLY
router.delete("/videos/:id", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const userId = Number(req.body.user_id);

    if (!Number.isInteger(videoId) || !Number.isInteger(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid video or user ID."
      });
    }

    const db = await openDatabase();

    const result = db.exec(
      "SELECT user_id, filename FROM videos WHERE id = ? LIMIT 1",
      [videoId]
    );

    if (!result.length || !result[0].values.length) {
      db.close();
      return res.status(404).json({
        success: false,
        message: "Video not found."
      });
    }

    const ownerId = Number(result[0].values[0][0]);
    const filename = result[0].values[0][1];

    if (ownerId !== userId) {
      db.close();
      return res.status(403).json({
        success: false,
        message: "Only the video owner can delete this video."
      });
    }

    db.run(
      "DELETE FROM videos WHERE id = ?",
      [videoId]
    );

    saveDatabase(db);
    db.close();

    const videoFile = path.join(__dirname, "uploads", filename);

    if (fs.existsSync(videoFile)) {
      fs.unlinkSync(videoFile);
    }

    res.json({
      success: true,
      message: "Video deleted successfully."
    });

  } catch (error) {
    console.error("Delete video error:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete video.",
      error: error.message
    });
  }
});
