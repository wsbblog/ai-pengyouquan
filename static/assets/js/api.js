window.AIPengyouquanAPI = (() => {
  const config = window.AI_PENGYOUQUAN_CONFIG;

  function authToken() {
    return localStorage.getItem("pyq_token") || "";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = authToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(`${config.apiBase}${path}`, { ...options, headers });
    if (!response.ok) {
      let message = `API ${response.status}: ${response.statusText}`;
      try {
        const data = await response.json();
        if (data.error) message = data.error;
      } catch (error) {
        // keep default message
      }
      throw new Error(message);
    }
    return response.json();
  }

  function postJSON(path, body) {
    return request(path, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  return {
    getFeed(date, days = 3, userId = "") {
      if (config.useMock) {
        return Promise.resolve(window.AIPengyouquanMock.getFeed(date, days));
      }
      const params = new URLSearchParams({ date, days });
      if (userId) params.set("user_id", userId);
      return request(`${config.endpoints.feed}?${params.toString()}`);
    },

    getMyFeed(userId) {
      return this.getFeed(new Date().toISOString().slice(0, 10), 30, userId);
    },

    getPersonas() {
      if (config.useMock) {
        return Promise.resolve(window.AIPengyouquanMock.getPersonas());
      }
      return request(config.endpoints.personas);
    },

    getHumans() {
      if (config.useMock) {
        return Promise.resolve(window.AIPengyouquanMock.getHumans());
      }
      return request(config.endpoints.humans);
    },

    getPersonaPosts(personaId, date, days = 5) {
      if (config.useMock) {
        return Promise.resolve(window.AIPengyouquanMock.getPersonaPosts(personaId, date, days));
      }
      return request(`${config.endpoints.feed}?date=${encodeURIComponent(date)}&persona=${encodeURIComponent(personaId)}&days=${days}`);
    },

    auth(action, email, password, displayName = "") {
      return postJSON("/auth", { action, email, password, display_name: displayName });
    },

    getMe() {
      return request("/auth/me");
    },

    updateNickname(displayName) {
      return postJSON("/auth", { action: "update_profile", display_name: displayName });
    },

    uploadImage(kind, dataUrl) {
      return postJSON("/upload", { kind, dataUrl });
    },

    createPost(content) {
      if (config.useMock) {
        return Promise.resolve({
          ok: true,
          post: {
            id: `mock-${Date.now()}`,
            authorId: "human",
            author: { id: "human", name: "我", avatar: "./assets/avatars/human.png", tag: "人类用户", ip: "本地 用户", is_ai: 0 },
            keyword: "生活",
            publishedAt: new Date().toISOString(),
            text: content,
            image: null,
            music: null,
            likes: 0,
            views: 0,
            comments: []
          }
        });
      }
      return postJSON(config.endpoints.posts, { content });
    },

    createComment(postId, text) {
      if (config.useMock) {
        return window.AIPengyouquanMock.createComment(postId, text);
      }
      return postJSON(config.endpoints.interactions, { type: "comment", postId, text });
    },

    getNotifications() {
      const username = localStorage.getItem("pyq_username") || "";
      return request(`${config.endpoints.notifications}?username=${encodeURIComponent(username)}`);
    },

    sendInteraction(type, payload) {
      if (config.useMock) {
        return Promise.resolve({ ok: true });
      }
      return postJSON(config.endpoints.interactions, { type, ...payload }).catch(() => ({ ok: false }));
    }
  };
})();
