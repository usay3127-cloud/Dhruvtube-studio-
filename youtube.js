const express = require("express");

const router = express.Router();

const API_KEY = process.env.YOUTUBE_API_KEY;

router.get("/youtube/recommendations", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "YouTube API key is not configured."
      });
    }

    const query = String(req.query.q || "technology").trim();

    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=25` +
      `&regionCode=US` +
      `&videoEmbeddable=true` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return res.status(searchResponse.status).json({
        success: false,
        message: searchData?.error?.message || "YouTube API request failed."
      });
    }

    const searchItems = (searchData.items || [])
      .filter(item => item.id?.videoId);

    const channelIds = [
      ...new Set(
        searchItems
          .map(item => item.snippet?.channelId)
          .filter(Boolean)
      )
    ];

    if (!channelIds.length) {
      return res.json({
        success: true,
        query,
        videos: []
      });
    }

    const channelUrl =
      "https://www.googleapis.com/youtube/v3/channels" +
      `?part=snippet&id=${channelIds.join(",")}` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      return res.status(channelResponse.status).json({
        success: false,
        message: channelData?.error?.message ||
          "YouTube channel lookup failed."
      });
    }

    const usChannels = new Set(
      (channelData.items || [])
        .filter(channel => channel.snippet?.country === "US")
        .map(channel => channel.id)
    );

    const videos = searchItems
      .filter(item => usChannels.has(item.snippet?.channelId))
      .slice(0, 10)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet?.title || "",
        channel: item.snippet?.channelTitle || "",
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        publishedAt: item.snippet?.publishedAt || "",
        youtube: true,
        embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`
      }));

    res.json({
      success: true,
      query,
      region: "US",
      videos
    });

  } catch (error) {
    console.error("YouTube API error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load YouTube recommendations."
    });
  }
});

router.get("/youtube/search", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "YouTube API key is not configured."
      });
    }

    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json({ success: true, videos: [] });
    }

    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=20` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.error?.message || "YouTube search failed."
      });
    }

    const videos = (data.items || [])
      .filter(item => item.id?.videoId)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet?.title || "",
        channel: item.snippet?.channelTitle || "",
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        publishedAt: item.snippet?.publishedAt || "",
        youtube: true,
        embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`
      }));

    res.json({ success: true, query, videos });

  } catch (error) {
    console.error("YouTube search error:", error);
    res.status(500).json({
      success: false,
      message: "Could not search YouTube."
    });
  }
});

module.exports = router;
