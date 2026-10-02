const API = "/api";

/* =========================
   BASIC HELPERS
========================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  const n = Number(value) || 0;

  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "K";

  return n.toLocaleString();
}

function getVideoTitle(video) {
  return video.title || video.name || "Untitled video";
}

function getVideoViews(video) {
  return Number(video.views ?? video.view_count ?? 0);
}

function getVideoLikes(video) {
  return Number(video.likes ?? video.like_count ?? 0);
}

function getVideoThumbnail(video) {
  return video.thumbnail || video.thumbnail_url || video.thumb || "";
}


/* =========================
   PAGE NAVIGATION
========================= */

function showPage(page) {
  document.querySelectorAll(".studio-page").forEach((section) => {
    section.classList.remove("active");
  });

  const target = $(`page-${page}`);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (page === "content") {
    loadContent();
  }

  if (page === "analytics") {
    loadAnalytics();
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");

  if (!button) return;

  event.preventDefault();
  showPage(button.dataset.page);
});


/* =========================
   UPLOAD MODAL
========================= */

function openUpload() {
  $("uploadModal")?.classList.remove("hidden");
}

function closeUpload() {
  $("uploadModal")?.classList.add("hidden");
}

$("uploadTopBtn")?.addEventListener("click", openUpload);
$("dashboardUploadBtn")?.addEventListener("click", openUpload);
$("contentUploadBtn")?.addEventListener("click", openUpload);
$("mobileUploadBtn")?.addEventListener("click", openUpload);
$("closeUpload")?.addEventListener("click", closeUpload);

$("uploadModal")?.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) {
    closeUpload();
  }
});


/* =========================
   LOAD VIDEOS
========================= */

let allVideos = [];

async function fetchVideos() {
  try {
    const response = await fetch(`${API}/videos`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Videos API returned ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.videos)) {
      return data.videos;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    return [];
  } catch (error) {
    console.error("Video loading failed:", error);
    return [];
  }
}


/* =========================
   VIDEO CARD
========================= */

function createVideoRow(video) {
  const row = document.createElement("article");
  row.className = "video-row";

  const title = escapeHTML(getVideoTitle(video));
  const views = formatNumber(getVideoViews(video));
  const likes = formatNumber(getVideoLikes(video));
  const thumbnail = getVideoThumbnail(video);

  const thumbHTML = thumbnail
    ? `<img src="${escapeHTML(thumbnail)}" alt="">`
    : `<span>▶</span>`;

  row.innerHTML = `
    <div class="video-thumb">
      ${thumbHTML}
    </div>

    <div>
      <div class="video-title">${title}</div>

      <div class="video-meta">
        <span>◉ ${views} views</span>
        <span>♥ ${likes} likes</span>
      </div>
    </div>

    <div class="video-status">
      Published
    </div>
  `;

  return row;
}


/* =========================
   DASHBOARD
========================= */

function updateDashboardStats(videos) {
  const totalViews = videos.reduce(
    (sum, video) => sum + getVideoViews(video),
    0
  );

  const totalLikes = videos.reduce(
    (sum, video) => sum + getVideoLikes(video),
    0
  );

  const count = videos.length;

  if ($("totalViews")) {
    $("totalViews").textContent = formatNumber(totalViews);
  }

  if ($("totalLikes")) {
    $("totalLikes").textContent = formatNumber(totalLikes);
  }

  if ($("totalVideos")) {
    $("totalVideos").textContent = formatNumber(count);
  }

  if ($("videoCount")) {
    $("videoCount").textContent = formatNumber(count);
  }

  if ($("analyticsViews")) {
    $("analyticsViews").textContent = formatNumber(totalViews);
  }

  if ($("analyticsViewsCard")) {
    $("analyticsViewsCard").textContent = formatNumber(totalViews);
  }

  if ($("analyticsLikes")) {
    $("analyticsLikes").textContent = formatNumber(totalLikes);
  }

  if ($("analyticsVideos")) {
    $("analyticsVideos").textContent = formatNumber(count);
  }

  if ($("earnViews")) {
    $("earnViews").textContent = formatNumber(totalViews);
  }

  if ($("earnVideos")) {
    $("earnVideos").textContent = formatNumber(count);
  }
}

function renderRecentVideos(videos) {
  const container = $("recentVideos");

  if (!container) return;

  container.innerHTML = "";

  if (!videos.length) {
    container.innerHTML = `
      <div class="loading-card">
        <span>No videos uploaded yet.</span>
      </div>
    `;

    return;
  }

  videos.slice(0, 5).forEach((video) => {
    container.appendChild(createVideoRow(video));
  });
}


/* =========================
   CONTENT PAGE
========================= */

function renderContentVideos(videos) {
  const container = $("contentVideos");

  if (!container) return;

  container.innerHTML = "";

  if (!videos.length) {
    container.innerHTML = `
      <div class="loading-card">
        <span>No content available.</span>
      </div>
    `;

    return;
  }

  videos.forEach((video) => {
    const row = createVideoRow(video);

    row.style.cursor = "pointer";

    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) {
        return;
      }

      openVideoEditor(video.id);
    });

    container.appendChild(row);
  });
}

async function loadContent() {
  const container = $("contentVideos");

  if (container) {
    container.innerHTML = `
      <div class="loading-card">
        <div class="loader"></div>
        <span>Loading content...</span>
      </div>
    `;
  }

  const videos = await fetchVideos();

  allVideos = videos;
  renderContentVideos(videos);
}


/* =========================
   ANALYTICS
========================= */

async function loadAnalytics() {
  if (!allVideos.length) {
    allVideos = await fetchVideos();
  }

  updateDashboardStats(allVideos);
}


/* =========================
   CHANNEL / USER
========================= */

function loadSavedUser() {
  try {
    const raw =
      localStorage.getItem("currentUser") ||
      localStorage.getItem("dhruvtubeUser") ||
      localStorage.getItem("user");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateChannelUI(user) {
  if (!user) return;

  const username =
    user.username ||
    user.name ||
    user.channel_name ||
    "DhruvTube";

  const handle =
    user.handle ||
    user.username ||
    "dhruvtube";

  const cleanHandle = String(handle).startsWith("@")
    ? handle
    : `@${handle}`;

  if ($("channelName")) {
    $("channelName").textContent = username;
  }

  if ($("dashboardChannelName")) {
    $("dashboardChannelName").textContent = username;
  }

  if ($("dashboardHandle")) {
    $("dashboardHandle").textContent = cleanHandle;
  }

  if ($("channelHandle")) {
    $("channelHandle").textContent = cleanHandle;
  }

  if ($("welcomeName")) {
    $("welcomeName").textContent = username;
  }

  if ($("studioAvatar")) {
    $("studioAvatar").textContent =
      username.charAt(0).toUpperCase();
  }

  const subscribers =
    Number(
      user.subscribers ??
      user.subscriber_count ??
      0
    );

  if ($("subscriberCount")) {
    $("subscriberCount").textContent =
      formatNumber(subscribers);
  }

  if ($("earnSubscribers")) {
    $("earnSubscribers").textContent =
      formatNumber(subscribers);
  }
}


/* =========================
   VIDEO UPLOAD
========================= */

async function uploadVideo() {
  const fileInput = $("videoFile");
  const titleInput = $("uploadTitle");
  const descriptionInput = $("uploadDescription");
  const status = $("uploadStatus");
  const button = $("startUploadBtn");

  if (!fileInput?.files?.length) {
    if (status) status.textContent = "Select a video first.";
    return;
  }

  const file = fileInput.files[0];
  const title =
    titleInput?.value.trim() ||
    file.name.replace(/\.[^/.]+$/, "");

  const description =
    descriptionInput?.value.trim() || "";

  const formData = new FormData();

  formData.append("video", file);
  formData.append("title", title);
  formData.append("description", description);

  const currentUser = loadSavedUser();

  if (!currentUser || !currentUser.id) {
    if (status) status.textContent = "Please sign in first.";
    return;
  }

  formData.append("user_id", String(currentUser.id));

  if (button) {
    button.disabled = true;
    button.textContent = "Uploading...";
  }

  if (status) {
    status.textContent = "Uploading video...";
  }

  try {
    const response = await fetch(`${API}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message ||
        data.error ||
        `Upload failed (${response.status})`
      );
    }

    if (status) {
      status.textContent = "Upload successful.";
    }

    fileInput.value = "";

    if (titleInput) titleInput.value = "";
    if (descriptionInput) descriptionInput.value = "";

    allVideos = await fetchVideos();

    updateDashboardStats(allVideos);
    renderRecentVideos(allVideos);
    renderContentVideos(allVideos);

    setTimeout(() => {
      closeUpload();
      showPage("content");
    }, 700);

  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent = error.message || "Upload failed.";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Upload video";
    }
  }
}

$("startUploadBtn")?.addEventListener(
  "click",
  uploadVideo
);


/* =========================
   REFRESH
========================= */

async function refreshStudio() {
  const button = $("refreshBtn");

  if (button) {
    button.disabled = true;
    button.style.transform = "rotate(360deg)";
  }

  allVideos = await fetchVideos();

  updateDashboardStats(allVideos);
  renderRecentVideos(allVideos);
  renderContentVideos(allVideos);

  if (button) {
    setTimeout(() => {
      button.disabled = false;
      button.style.transform = "";
    }, 400);
  }
}

$("refreshBtn")?.addEventListener(
  "click",
  refreshStudio
);


/* =========================
   INIT
========================= */

async function initStudio() {
  const user = loadSavedUser();

  updateChannelUI(user);

  const videosContainer = $("recentVideos");

  if (videosContainer) {
    videosContainer.innerHTML = `
      <div class="loading-card">
        <div class="loader"></div>
        <span>Loading your videos...</span>
      </div>
    `;
  }

  allVideos = await fetchVideos();

  updateDashboardStats(allVideos);
  renderRecentVideos(allVideos);
}

document.addEventListener(
  "DOMContentLoaded",
  initStudio
);

/* =========================
   STUDIO PAGE NAVIGATION
========================= */

function showStudioPage(page) {
  document.querySelectorAll(".studio-page").forEach(section => {
    section.classList.remove("active");
  });

  const target = document.getElementById(`page-${page}`);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn, .side-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

/* =========================
   VIDEO EDITOR
========================= */

let editingVideo = null;

function openVideoEditor(videoId) {
  const video = allVideos.find(v => Number(v.id) === Number(videoId));

  if (!video) return;

  const user = loadSavedUser();

  if (!user || Number(video.user_id) !== Number(user.id)) {
    alert("Only the video owner can edit this video.");
    return;
  }

  editingVideo = video;

  const title = $("editorTitle");
  const description = $("editorDescription");
  const views = $("editorViews");
  const id = $("editorVideoId");
  const player = $("editorVideo");
  const status = $("editorStatus");

  if (title) title.value = video.title || "";
  if (description) description.value = video.description || "";
  if (views) views.textContent = video.views || 0;
  if (id) id.textContent = video.id;
  if (player) {
    player.src = video.url;
    player.load();
  }
  if (status) status.textContent = "";

  showStudioPage("video-editor");
}

$("editorBackBtn")?.addEventListener("click", () => {
  showStudioPage("content");
});

$("editorSaveBtn")?.addEventListener("click", async () => {
  if (!editingVideo) return;

  const user = loadSavedUser();

  if (!user?.id) {
    alert("Please sign in first.");
    return;
  }

  const title = $("editorTitle")?.value.trim();
  const description = $("editorDescription")?.value.trim() || "";
  const status = $("editorStatus");
  const button = $("editorSaveBtn");

  if (!title) {
    if (status) status.textContent = "Title is required.";
    return;
  }

  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const response = await fetch(
      `${API}/videos/${editingVideo.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: user.id,
          title,
          description
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not save changes.");
    }

    editingVideo.title = title;
    editingVideo.description = description;

    if (status) status.textContent = "Changes saved.";

    allVideos = await fetchVideos();
    updateDashboardStats(allVideos);
    renderRecentVideos(allVideos);
    renderContentVideos(allVideos);

  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Save changes";
  }
});

$("editorDeleteBtn")?.addEventListener("click", async () => {
  if (!editingVideo) return;

  const user = loadSavedUser();

  if (!user?.id) {
    alert("Please sign in first.");
    return;
  }

  if (!confirm("Delete this video permanently?")) return;

  const button = $("editorDeleteBtn");
  const status = $("editorStatus");

  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    const response = await fetch(
      `${API}/videos/${editingVideo.id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: user.id
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not delete video.");
    }

    editingVideo = null;
    allVideos = await fetchVideos();

    updateDashboardStats(allVideos);
    renderRecentVideos(allVideos);
    renderContentVideos(allVideos);

    showStudioPage("content");

  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Delete video";
  }
});


/* =========================
   GOOGLE AUTH / ACCOUNT
========================= */

function openAuth() {
  const modal = $("authModal");
  const message = $("authMessage");

  if (!modal) return;

  modal.classList.remove("hidden");

  if (message) {
    message.textContent =
      "Connect your Google account and YouTube channel.";
  }
}

function closeAuth() {
  $("authModal")?.classList.add("hidden");
}


/* =========================
   GOOGLE LOGIN
========================= */

$("googleLoginBtn")?.addEventListener("click", () => {
  const button = $("googleLoginBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Connecting...";
  }

  window.location.href = "/api/youtube/connect";
});


/* =========================
   PROFILE BUTTON
========================= */

$("profileBtn")?.addEventListener("click", () => {
  const user = loadSavedUser();

  if (user && user.id) {
    showStudioPage("dashboard");
    updateChannelUI(user);
  } else {
    openAuth();
  }
});


/* =========================
   CLOSE AUTH
========================= */

$("closeAuth")?.addEventListener(
  "click",
  closeAuth
);

$("authModal")?.addEventListener(
  "click",
  (event) => {
    if (
      event.target.classList.contains(
        "modal-backdrop"
      )
    ) {
      closeAuth();
    }
  }
);


/* =========================
   GOOGLE LOGIN CALLBACK
========================= */

function handleGoogleLoginCallback() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  if (
    params.get("google_login") !==
    "success"
  ) {
    return;
  }

  const encodedUser =
    params.get("user");

  if (encodedUser) {
    try {
      const user =
        JSON.parse(
          decodeURIComponent(
            encodedUser
          )
        );

      localStorage.setItem(
        "currentUser",
        JSON.stringify(user)
      );

      localStorage.setItem(
        "dhruvtubeUser",
        JSON.stringify(user)
      );

      localStorage.setItem(
        "dhruvtube_google_user",
        JSON.stringify(user)
      );

      updateChannelUI(user);

    } catch (error) {
      console.error(
        "Google login user error:",
        error
      );
    }
  }

  window.history.replaceState(
    {},
    document.title,
    window.location.pathname
  );
}

handleGoogleLoginCallback();
