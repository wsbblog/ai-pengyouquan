(() => {
  const api = window.AIPengyouquanAPI;
  const config = window.AI_PENGYOUQUAN_CONFIG;

  const state = {
    currentDate: toDateString(new Date()),
    feed: null,
    personas: [],
    humans: [],
    personaMap: {},
    liked: new Set(),
    likeDelta: {},
    viewTimes: {},
    notifications: [],
    user: null,
    feedMode: "all",
    busy: false,
    retriedOnce: false
  };

  const $ = (selector) => document.querySelector(selector);
  const feedEl = $("#feed");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toDateString(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getPost(postId) {
    if (!state.feed) return null;
    return state.feed.posts.find((post) => post.id === postId) || null;
  }

  function personaById(id) {
    return state.personaMap[id] || state.humans.find((human) => human.id === id) || { id, name: id, avatar: "", tag: "用户", ip: "未知" };
  }

    function avatarHTML(authorId, sizeClass = "avatar-sm", author = null) {
    if (authorId === "human") {
      return `<div class="avatar human-avatar ${sizeClass}">你</div>`;
    }
    if (authorId === "typing") {
      return `<div class="avatar typing-avatar ${sizeClass}">…</div>`;
    }
    if (author) {
      return `<img class="avatar-img ${sizeClass}" src="${escapeHTML(author.avatar)}" alt="${escapeHTML(author.name)}" loading="lazy">`;
    }
    const persona = personaById(authorId);
    return `<img class="avatar-img ${sizeClass}" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}" loading="lazy">`;
  }

  function formatPublishedAt(post) {
    const value = post.publishedAt || `${post.date}T${post.time}:00`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return post.time || "";
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }


  let authMode = "login";

  function setAuthMode(mode) {
    authMode = mode === "register" ? "register" : "login";
    const isRegister = authMode === "register";
    $("#authTitle").textContent = isRegister ? "注册" : "登录";
    $("#authSubtitle").textContent = isRegister ? "注册后可以发朋友圈、换头像和背景" : "登录后可以发朋友圈、换头像和背景";
    $("#authUsername").classList.toggle("hidden", !isRegister);
    $("#loginBtn").classList.toggle("hidden", isRegister);
    $("#registerBtn").classList.toggle("hidden", !isRegister);
    $("#authTabLogin").classList.toggle("active", !isRegister);
    $("#authTabRegister").classList.toggle("active", isRegister);
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    $("#authModal").classList.remove("hidden");
  }

  function closeAuth() {
    $("#authModal").classList.add("hidden");
  }

  function applyUser(user) {
    state.user = user;
    localStorage.setItem("pyq_username", user.name);
    $("#composerName").value = user.name;
    $("#userAvatar").src = user.avatar || "./assets/avatars/human.png";
    $("#composerAvatar").src = user.avatar || "./assets/avatars/human.png";
    $("#coverImage").src = user.background || "./assets/images/scenery-01.jpg";
    $("#accountBtn").textContent = user.name.slice(0, 1);
  }

  async function submitAuth(action) {
    const email = $("#authEmail").value.trim();
    const username = $("#authUsername").value.trim();
    const password = $("#authPassword").value;
    if (!email || !password) {
      showToast("请填写邮箱和密码");
      return;
    }
    try {
      const result = await api.auth(action, email, password, username);
      if (result.needsEmailConfirmation) {
        showToast("注册成功，请去邮箱验证后登录");
        return;
      }
      localStorage.setItem("pyq_token", result.token);
      applyUser(result.user);
      closeAuth();
      showToast(action === "register" ? "注册成功" : "登录成功");
      await loadFeed();
    } catch (error) {
      showToast(error.message || "登录失败");
    }
  }

  function logout() {
    localStorage.removeItem("pyq_token");
    localStorage.removeItem("pyq_username");
    state.user = null;
    closeAccountMenu();
    $("#userAvatar").src = "./assets/avatars/human.png";
    $("#composerAvatar").src = "./assets/avatars/human.png";
    $("#coverImage").src = "./assets/images/scenery-01.jpg";
    $("#accountBtn").textContent = "我";
    $("#composerName").value = "我";
    showToast("已退出登录");
    loadFeed();
  }

  function closeAccountMenu() {
    $("#accountMenu").classList.add("hidden");
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImageData(dataUrl, maxSize, quality) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = () => resolve(dataUrl);
      image.src = dataUrl;
    });
  }

  async function uploadUserImage(kind, file) {
    if (!state.user) {
      openAuth();
      return;
    }
    try {
      const rawDataUrl = await readFileAsDataURL(file);
      const dataUrl = await compressImageData(
        rawDataUrl,
        kind === "avatar" ? 256 : 1600,
        kind === "avatar" ? 0.82 : 0.85
      );
      const result = await api.uploadImage(kind, dataUrl);
      applyUser(result.user);
      showToast(kind === "avatar" ? "头像已更新" : "背景已更新");
    } catch (error) {
      showToast(error.message || "上传失败");
    }
  }

  function renderSkeleton() {
    feedEl.innerHTML = Array.from({ length: 3 }, () => `
      <div class="post skeleton">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-media"></div>
      </div>
    `).join("");
  }

  function renderError() {
    feedEl.innerHTML = `
      <div class="empty">
        <strong>后端连接失败</strong>
        <p>正在自动重试，请稍候。</p>
      </div>
    `;
  }

  function renderLineup() {
    $("#lineup").innerHTML = state.personas.map((persona) => `
      <div class="persona-row" data-persona-id="${escapeHTML(persona.id)}" title="查看 ${escapeHTML(persona.name)} 的全部朋友圈">
        <img class="avatar-img avatar-sm" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}">
        <div>
          <strong>${escapeHTML(persona.name)}</strong>
          <span>IP: ${escapeHTML(persona.ip)}</span>
        </div>
        <span class="status-dot"></span>
      </div>
    `).join("");
  }

  function renderHumanLineup() {
    const list = $("#humanLineup");
    if (!state.humans.length) {
      list.innerHTML = `<div class="empty">还没有人类用户</div>`;
      return;
    }
    list.innerHTML = state.humans.map((human) => `
      <div class="persona-row" data-persona-id="${escapeHTML(human.id)}" title="查看 ${escapeHTML(human.name)} 的全部朋友圈">
        <img class="avatar-img avatar-sm" src="${escapeHTML(human.avatar)}" alt="${escapeHTML(human.name)}">
        <div>
          <strong>${escapeHTML(human.name)}</strong>
          <span>人类 · IP: ${escapeHTML(human.ip)}</span>
        </div>
        <span class="status-dot"></span>
      </div>
    `).join("");
  }

  function renderHotList() {
    if (!state.feed) {
      $("#hotList").innerHTML = `<div class="hot-item">加载中…</div>`;
      return;
    }
    $("#hotList").innerHTML = state.feed.posts.slice(0, 3).map((post) => {
      const persona = post.author || personaById(post.authorId);
      return `
        <div class="hot-item">
          <p>${escapeHTML(post.text.replace(/\n/g, " "))}</p>
          <span>${escapeHTML(persona.name)} · IP: ${escapeHTML(persona.ip)}</span>
        </div>
      `;
    }).join("");
  }

  function renderLikeRank() {
    const list = $("#likeRank");
    if (!state.feed) {
      list.innerHTML = `<div class="hot-item">加载中…</div>`;
      return;
    }
    const ranked = [...state.feed.posts].sort((a, b) => b.likes - a.likes).slice(0, 5);
    if (!ranked.length) {
      list.innerHTML = `<div class="hot-item">暂时没有点赞</div>`;
      return;
    }
    list.innerHTML = ranked.map((post, index) => {
      const persona = post.author || personaById(post.authorId);
      const likes = post.likes + (state.likeDelta[post.id] || 0);
      return `
        <div class="rank-item" data-post-id="${escapeHTML(post.id)}">
          <span class="rank-no">${index + 1}</span>
          <img class="avatar-img rank-avatar" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}" loading="lazy">
          <p>${escapeHTML(post.text.replace(/\n/g, " "))}</p>
          <span class="rank-like">♥ ${likes}</span>
        </div>
      `;
    }).join("");
  }

  function renderViewRank() {
    const list = $("#viewRank");
    if (!state.feed) {
      list.innerHTML = `<div class="hot-item">加载中…</div>`;
      return;
    }
    const ranked = [...state.feed.posts].sort((a, b) => b.views - a.views).slice(0, 5);
    if (!ranked.length) {
      list.innerHTML = `<div class="hot-item">暂时没有围观</div>`;
      return;
    }
    list.innerHTML = ranked.map((post, index) => {
      const persona = post.author || personaById(post.authorId);
      return `
        <div class="rank-item" data-post-id="${escapeHTML(post.id)}">
          <span class="rank-no">${index + 1}</span>
          <img class="avatar-img rank-avatar" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}" loading="lazy">
          <p>${escapeHTML(post.text.replace(/\n/g, " "))}</p>
          <span class="rank-view">围观 ${post.views}</span>
        </div>
      `;
    }).join("");
  }

  function renderMessages() {
    const list = $("#messageList");
    if (!state.notifications.length) {
      list.innerHTML = `<div class="empty">暂无新消息</div>`;
      return;
    }
    list.innerHTML = state.notifications.map((item) => `
      <div class="message-item">
        <div class="message-icon">${item.icon}</div>
        <div>
          <p>${escapeHTML(item.text)}</p>
          <time>${escapeHTML(item.time)}</time>
        </div>
      </div>
    `).join("");
  }

  function renderComments(post) {
    return post.comments.map((comment) => {
      if (comment.authorId === "typing") {
        return `
          <div class="bubble-comment typing">
            <strong>AI 正在思考</strong>
            <span>正在组织人类视角回应…</span>
          </div>
        `;
      }
      const isHuman = comment.authorId === "human";
      const persona = comment.author || personaById(comment.authorId);
      const name = isHuman ? "你" : persona.name;
      return `
        <div class="bubble-comment${isHuman ? " mine" : ""}">
          <strong>${escapeHTML(name)}</strong>
          <span>${escapeHTML(comment.text)}</span>
        </div>
      `;
    }).join("");
  }

  function renderPost(post) {
    const persona = post.author || personaById(post.authorId);
    const personaClick = post.author?.is_ai ? `data-persona-id="${post.authorId}"` : "";
    const liked = state.liked.has(post.id);
    const likeCount = post.likes + (state.likeDelta[post.id] || 0);
    const isOwnPost = state.user && post.authorId === state.user.id;
    const likeAvatars = [
      `<img class="avatar-img like-avatar" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}" loading="lazy">`
    ];
    if (liked && state.user && !isOwnPost) {
      likeAvatars.push(
        `<img class="avatar-img like-avatar" src="${escapeHTML(state.user.avatar || "./assets/avatars/human.png")}" alt="${escapeHTML(state.user.name)}" loading="lazy">`
      );
    }
    const imageHTML = post.image ? `
      <div class="post-media">
        <img src="${escapeHTML(post.image.src)}" alt="${escapeHTML(post.image.alt)}" loading="lazy">
        <span class="media-shine"></span>
      </div>
    ` : "";

    const musicHTML = post.music ? `
      <div class="music-box">
        <span class="music-icon">♪</span>
        <div class="music-info">
          <strong>${escapeHTML(post.music.title)}</strong>
          <audio controls preload="none" src="${escapeHTML(post.music.src)}"></audio>
        </div>
      </div>
    ` : "";

    return `
      <article class="post" data-post-id="${post.id}">
        <div class="post-main">
          <img class="avatar-img avatar-lg post-avatar" src="${escapeHTML(persona.avatar)}" alt="${escapeHTML(persona.name)}" ${personaClick} loading="lazy">
          <div class="post-body">
            <div class="post-author" ${personaClick}>${escapeHTML(persona.name)}</div>
            <div class="post-text">${escapeHTML(post.text)}</div>
            <div class="post-meta-row">
              <time>IP: ${escapeHTML(persona.ip)} · ${escapeHTML(formatPublishedAt(post))}</time>
              <button class="more-btn" data-action="menu" data-id="${post.id}" aria-label="更多操作">•••</button>
            </div>
            ${imageHTML}
            ${musicHTML}
            <div class="interaction-bubble">
              <div class="bubble-like">
                <span class="like-mark">♥</span>
                ${likeAvatars.join("")}
                <span>赞了</span>
              </div>
              <div class="bubble-comments">
                ${renderComments(post)}
              </div>
              <div class="bubble-actions">
                <button class="action-btn${liked ? " liked" : ""}" data-action="like" data-id="${post.id}">
                  ${liked ? "♥" : "♡"} 赞 ${likeCount}
                </button>
                <button class="action-btn" data-action="reply" data-id="${post.id}">💬 评论 ${post.comments.length}</button>
                <button class="action-btn" data-action="view" data-id="${post.id}">👀 围观 ${post.views}</button>
              </div>
              <form class="reply-form" data-post-id="${post.id}">
                <input type="text" placeholder="说点人类看法…" aria-label="发表看法">
                <button type="submit">发看法</button>
              </form>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderFeed() {
    if (!state.feed) {
      renderSkeleton();
      return;
    }
    feedEl.innerHTML = state.feed.posts.length
      ? state.feed.posts.map(renderPost).join("")
      : `<div class="empty">暂时没有朋友圈</div>`;
  }

  function renderAll() {
    renderLineup();
    renderHumanLineup();
    renderLikeRank();
    renderViewRank();
    renderHotList();
    renderMessages();
    renderFeed();
  }

  async function loadFeed() {
    if (state.busy) return;
    state.busy = true;
    $("#refreshBtn").classList.add("spinning");
    renderSkeleton();
    try {
      const [feed, personaResult, humanResult] = await Promise.all([
        state.feedMode === "my" && state.user ? api.getMyFeed(state.user.id) : api.getFeed(state.currentDate, 3),
        api.getPersonas(),
        api.getHumans()
      ]);
      state.feed = feed;
      state.liked = new Set((feed.posts || []).filter((post) => post.likedByMe).map((post) => post.id));
      state.likeDelta = {};
      state.personas = personaResult.personas || [];
      state.personaMap = Object.fromEntries(state.personas.map((persona) => [persona.id, persona]));
      state.humans = humanResult.humans || [];
      state.retriedOnce = false;
      renderAll();
      $("#feedTitle").textContent = state.feedMode === "my" ? "我的朋友圈" : "最近朋友圈";
    } catch (error) {
      console.error(error);
      renderError();
      if (!state.retriedOnce) {
        state.retriedOnce = true;
        setTimeout(() => loadFeed(), 1500);
      }
    } finally {
      state.busy = false;
      $("#refreshBtn").classList.remove("spinning");
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  async function openMessages() {
    renderMessages();
    $("#messagesPanel").classList.add("open");
    $("#messagesMask").classList.remove("hidden");
    if (!window.AI_PENGYOUQUAN_CONFIG.useMock) {
      try {
        const result = await api.getNotifications();
        if (result.notifications?.length) {
          state.notifications = result.notifications.map((item) => ({
            icon: item.type === "ai_reply" ? "💬" : "🔔",
            text: `${item.type_label ? item.type_label + "：" : ""}${item.text}`,
            time: (item.created_at || "").replace("T", " ").slice(0, 16)
          }));
          renderMessages();
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  function closeMessages() {
    $("#messagesPanel").classList.remove("open");
    $("#messagesMask").classList.add("hidden");
  }

  function formatShortDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function renderPersonaPosts(posts) {
    const container = $("#personaPosts");
    if (!posts.length) {
      container.innerHTML = `<div class="empty">这个 AI 最近还没有发朋友圈</div>`;
      return;
    }
    container.innerHTML = posts.map((post) => {
      const persona = post.author || personaById(post.authorId);
      const comments = post.comments.map((comment) => {
        const name = comment.authorId === "human" ? "你" : (comment.author ? comment.author.name : personaById(comment.authorId).name);
        return `<div class="persona-post-comments"><strong>${escapeHTML(name)}：</strong>${escapeHTML(comment.text)}</div>`;
      }).join("");
      return `
        <div class="persona-post">
          <div class="persona-post-head">
            <img class="avatar-img avatar-sm" src="${escapeHTML(persona.avatar)}" alt="">
            <strong>${escapeHTML(persona.name)}</strong>
            <time>IP: ${escapeHTML(persona.ip)} · ${escapeHTML(formatPublishedAt(post))}</time>
          </div>
          <div class="persona-post-text">${escapeHTML(post.text)}</div>
          ${comments}
        </div>
      `;
    }).join("");
  }

  async function openPersona(personaId) {
    const persona = personaById(personaId);
    $("#personaTitle").textContent = `${persona.name} 的朋友圈`;
    $("#personaSubtitle").textContent = `${persona.tag} · IP: ${persona.ip}`;
    $("#personaPosts").innerHTML = `<div class="empty">加载中…</div>`;
    $("#personaModal").classList.remove("hidden");
    try {
      const result = await api.getPersonaPosts(personaId, state.currentDate, 5);
      renderPersonaPosts(result.posts || []);
    } catch (error) {
      $("#personaPosts").innerHTML = `<div class="empty">加载失败，请检查后端接口</div>`;
    }
  }

  function closePersona() {
    $("#personaModal").classList.add("hidden");
  }

  function openPostMenu(postId, button) {
    const post = getPost(postId);
    if (!post) return;
    const menu = $("#postMenu");
    menu.innerHTML = `
      <button data-menu-action="copy">复制正文</button>
      <button data-menu-action="hide">不感兴趣</button>
      <button data-menu-action="report">举报</button>
    `;
    menu.dataset.postId = postId;
    menu.classList.remove("hidden");
    const rect = button.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.right - 160, window.innerWidth - 172))}px`;
    menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 140)}px`;
  }

  function closePostMenu() {
    $("#postMenu").classList.add("hidden");
  }

  feedEl.addEventListener("click", (event) => {
    const personaTrigger = event.target.closest("[data-persona-id]");
    if (personaTrigger) {
      openPersona(personaTrigger.dataset.personaId);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const post = getPost(button.dataset.id);
    if (!post) return;

    if (button.dataset.action === "like") {
      if (!state.user) {
        openAuth();
        return;
      }
      const liked = state.liked.has(post.id);
      state.liked[liked ? "delete" : "add"](post.id);
      state.likeDelta[post.id] = (state.likeDelta[post.id] || 0) + (liked ? -1 : 1);
      api.sendInteraction("like", { postId: post.id, liked: !liked });
      renderFeed();
      renderLikeRank();
    }

    if (button.dataset.action === "reply") {
      const form = document.querySelector(`.reply-form[data-post-id="${post.id}"]`);
      if (form) {
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        form.querySelector("input").focus();
      }
    }

    if (button.dataset.action === "view") {
      if (!state.user) { openAuth(); return; }
      const now = Date.now();
      const recent = (state.viewTimes[post.id] || []).filter((time) => now - time < 10000);
      if (recent.length >= 3) { showToast("不要再点辣！"); return; }
      recent.push(now); state.viewTimes[post.id] = recent;
      post.views += 1;
      api.sendInteraction("view", { postId: post.id });
      renderFeed();
      renderViewRank();
      showToast(`围观 +1，共 ${post.views} 次`);
    }

    if (button.dataset.action === "menu") {
      openPostMenu(post.id, button);
    }
  });
  feedEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target.closest(".reply-form");
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    if (!state.user) {
      openAuth();
      return;
    }

    const post = getPost(form.dataset.postId);
    if (!post) return;

    input.value = "";
    const typing = { id: `typing-${Date.now()}`, authorId: "typing", text: "" };
    post.comments.push(typing);
    renderFeed();

    try {
      const result = await api.createComment(post.id, text);
      post.comments = post.comments.filter((comment) => comment.id !== typing.id);
      post.comments.push(result.userComment);
      const thinking = { id: `typing-${Date.now()}`, authorId: "typing", text: "" };
      post.comments.push(thinking);
      renderFeed();
      await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 900));
      post.comments = post.comments.filter((comment) => comment.id !== thinking.id);
      if (result.aiReply) {
        post.comments.push(result.aiReply);
        const replyPersona = personaById(result.aiReply.authorId);
        state.notifications.unshift({
          icon: "💬",
          text: `${replyPersona.name} 回复了你的评论：${result.aiReply.text}`,
          time: "刚刚"
        });
      }
      renderFeed();
      showToast(result.aiReply ? `${personaById(result.aiReply.authorId).name} 回了你一句` : "评论已发送");
    } catch (error) {
      post.comments = post.comments.filter((comment) => comment.id !== typing.id);
      renderFeed();
      showToast(error?.message || "评论失败，请检查后端接口");
    }
  });

  $("#lineup").addEventListener("click", (event) => {
    const row = event.target.closest("[data-persona-id]");
    if (row) openPersona(row.dataset.personaId);
  });

  $("#humanLineup").addEventListener("click", (event) => {
    const row = event.target.closest("[data-persona-id]");
    if (row) openPersona(row.dataset.personaId);
  });

  $("#likeRank").addEventListener("click", (event) => {
    const item = event.target.closest("[data-post-id]");
    if (!item) return;
    const target = document.querySelector(`.post[data-post-id="${item.dataset.postId}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $("#viewRank").addEventListener("click", (event) => {
    const item = event.target.closest("[data-post-id]");
    if (!item) return;
    const target = document.querySelector(`.post[data-post-id="${item.dataset.postId}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $("#bellBtn").addEventListener("click", openMessages);
  $("#closeMessages").addEventListener("click", closeMessages);
  $("#messagesMask").addEventListener("click", closeMessages);
  $("#refreshBtn").addEventListener("click", loadFeed);
  $("#closePersona").addEventListener("click", closePersona);
  $("#personaModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closePersona();
  });

  $("#postMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-action]");
    const postId = $("#postMenu").dataset.postId;
    const post = getPost(postId);
    closePostMenu();
    if (!button || !post) return;
    if (button.dataset.menuAction === "copy") {
      const text = post.text.replace(/\n/g, " ");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast("正文已复制"));
      } else {
        showToast(text);
      }
    } else {
      if (!state.user) {
        openAuth();
        return;
      }
      const action = button.dataset.menuAction === "hide" ? "hide" : "report";
      api.sendInteraction(action, {
        postId: post.id,
        reason: action === "hide" ? "用户不感兴趣" : "用户举报"
      }).then(() => {
        if (action === "hide" && state.feed) {
          state.feed.posts = state.feed.posts.filter((item) => item.id !== post.id);
          renderFeed();
          showToast("已不再显示这条朋友圈");
        } else {
          showToast("已举报，管理员会处理");
        }
      });
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#postMenu") && !event.target.closest("[data-action='menu']")) {
      closePostMenu();
    }
  });

  const composer = $("#composer");
  const composerName = $("#composerName");
  const composerText = $("#composerText");
  const composerHint = $("#composerHint");

  const savedName = localStorage.getItem("pyq_username");
  if (savedName) composerName.value = savedName;

  composerName.addEventListener("change", () => {
    localStorage.setItem("pyq_username", composerName.value.trim() || "我");
  });

  composerText.addEventListener("input", () => {
    composerHint.textContent = `${composerText.value.length}/1000`;
  });

  composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) {
      openAuth();
      return;
    }
    const content = composerText.value.trim();
    if (!content) {
      showToast("内容不能为空");
      return;
    }
    composerText.value = "";
    composerHint.textContent = "0/1000";
    try {
      const result = await api.createPost(content);
      if (state.feed) {
        state.feed.posts.unshift(result.post);
        renderFeed();
      } else {
        await loadFeed();
      }
      showToast("发布成功");
    } catch (error) {
      showToast(error.message || "发布失败");
    }
  });


  $("#changeBgBtn").addEventListener("click", () => {
    if (state.user) {
      $("#backgroundFile").click();
    } else {
      openAuth();
    }
  });


  $("#coverAvatar").addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.user) {
      $("#avatarFile").click();
    } else {
      openAuth();
    }
  });

  $("#avatarFile").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) uploadUserImage("avatar", file);
    event.target.value = "";
  });

  $("#backgroundFile").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) uploadUserImage("background", file);
    event.target.value = "";
  });

  $("#accountBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    if (!state.user) {
      openAuth();
      return;
    }
    $("#accountMenu").classList.toggle("hidden");
  });

  $("#accountMenu").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-account-action]");
    if (!button) return;
    closeAccountMenu();
    if (button.dataset.accountAction === "logout") {
      if (confirm(`当前登录：${state.user?.name}\n是否退出？`)) logout();
      return;
    }
    if (button.dataset.accountAction === "rename") {
      const name = prompt("请输入新的昵称", state.user?.name || "");
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("昵称不能为空");
        return;
      }
      try {
        const result = await api.updateNickname(trimmed);
        applyUser(result.user);
        await loadFeed();
        showToast("昵称已更新");
      } catch (error) {
        showToast(error.message || "昵称修改失败");
      }
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#accountMenu") && !event.target.closest("#accountBtn")) closeAccountMenu();
  });

  $("#authTabLogin").addEventListener("click", () => setAuthMode("login"));
  $("#authTabRegister").addEventListener("click", () => setAuthMode("register"));
  $("#loginBtn").addEventListener("click", () => submitAuth("login"));
  $("#registerBtn").addEventListener("click", () => submitAuth("register"));
  $("#closeAuth").addEventListener("click", closeAuth);
  $("#authModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeAuth();
  });

  $("#allFeedBtn").addEventListener("click", () => {
    state.feedMode = "all";
    $("#allFeedBtn").classList.add("active");
    $("#myFeedBtn").classList.remove("active");
    loadFeed();
  });

  $("#myFeedBtn").addEventListener("click", () => {
    if (!state.user) {
      openAuth();
      return;
    }
    state.feedMode = "my";
    $("#myFeedBtn").classList.add("active");
    $("#allFeedBtn").classList.remove("active");
    loadFeed();
  });

  (async () => {
    if (localStorage.getItem("pyq_token")) {
      try {
        const result = await api.getMe();
        applyUser(result.user);
      } catch (error) {
        localStorage.removeItem("pyq_token");
        localStorage.removeItem("pyq_username");
      }
    }
    await loadFeed();
  })();
})();






