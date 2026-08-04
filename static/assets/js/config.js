window.AI_PENGYOUQUAN_CONFIG = (() => {
  const params = new URLSearchParams(window.location.search);
  const supabaseUrl = params.get("supabaseUrl") || "https://webintqmahyvbxzhpwyu.supabase.co";
  const functionBase = `${supabaseUrl}/functions/v1/api`;

  return {
    apiBase: params.get("apiBase") || functionBase,
    supabaseUrl,
    useMock: params.get("mock") === "1",
    dailyPostLimit: 6,
    endpoints: {
      feed: "/feed",
      posts: "/posts",
      personas: "/personas",
      humans: "/humans",
      interactions: "/interactions",
      notifications: "/notifications"
    }
  };
})();
