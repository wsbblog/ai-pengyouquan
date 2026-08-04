import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const corsHeaders = {
  ...sdkCorsHeaders,
  "Access-Control-Allow-Headers": `${sdkCorsHeaders["Access-Control-Allow-Headers"] || ""}, x-admin-password`,
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PYQ_SUPABASE_URL") || "";
const SUPABASE_SECRET_KEY = Deno.env.get("PYQ_SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") || "admin123";

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BANNED_WORDS = [
  "傻逼", "煞笔", "妈的", "他妈的", "去死", "滚蛋", "脑残", "智障", "废物",
  "操你", "cnm", "nmsl", "sb", "垃圾人", "贱人", "婊子", "狗东西",
];

async function getBannedWords() {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "banned_words").maybeSingle();
  if (Array.isArray(data?.value) && data.value.length) return data.value;
  return BANNED_WORDS;
}

const KEYWORD_TEMPLATES = [
  "我们那时候的{kw}就是有的",
  "美国人有",
  "那是因为你没有玩原神",
  "人民的{kw}？",
  "给我素未谋面的兄弟来点{kw}",
  "{kw}可以",
  "有发朋友圈的时间不如多刷两道题",
  "我的{kw}就是有的你气不气？",
  "觉得没有{kw}那是你没有玩我的世界，我的世界就是{kw}",
  "家人们谁懂啊？原来我们都是没有{kw}的",
  "总归会有的",
  "接接接",
  "十二星座决定你的{kw}",
  "没有{kw}喵，没有{kw}谢谢喵",
  "家里进{kw}了",
  "抽两个人发{kw}",
  "留个句号吧，万一哪天就有{kw}了呢。。。。",
  "111 在吗兄弟借点{kw}",
  "从没说过{kw}，打败 99% 的网友",
  "一人一句{kw}，我写日记上，会加 id",
  "看到就提醒我去找{kw}",
  "宝子你是真心觉得没有{kw}吗？我怎么觉得有点不对劲呢？",
  "我直接正太扭腰躲过{kw}",
  "留下三朵花致敬{kw}吧",
  "我用塔罗牌算一下到底有没有{kw}",
  "蹲{kw}，放我包踢",
  "啊啊啊啊宝宝你是一个香香软软的{kw}",
  "我一朋友那才叫有{kw}呢",
  "孙笑川干的",
  "我保证，没有{kw}",
  "急了急了",
  "{kw}，你阿帕次",
  "我有{kw}收款码",
  "上面这个号不用了，加这个",
  "亿万人拥有{kw}",
  "{kw}耍起",
  "这个会考吗？",
  "孙孙{kw}吃汤饭喽",
  "可我觉得每个人都是有{kw}的，十分钟后没人加就删",
  "{kw}闹麻了",
  "{kw}这不是好事吗？",
  "@{kw}",
  "那是因为你不是风象星座吧？",
  "虽然五分钟后我就会忘了这件事，但此刻我们是{kw}啊！",
  "小伙无{kw}，能量低微",
  "太痛苦了，你没有什么不好，你只是{kw}错了人",
  "{kw}は、私の中で一番大切なものです。",
  "女孩，我保证你拥有{kw}",
  "带派不{kw}？",
  "我打算取消点赞了，我还以为我拥有{kw}了",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function normalizeLineBreaks(value: string) {
  return String(value || "").replace(/\\n/g, "\n");
}

function publicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const clean = path.replace(/^\/storage\/v1\/object\/public\//, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${clean}`;
}

function bearerToken(req: Request) {
  return (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
}

async function currentUser(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

async function getProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

function profileToPersona(profile: any) {
  const raw = profile || {};
  return {
    id: raw.id,
    name: raw.display_name || raw.email || raw.user_metadata?.display_name || "用户",
    avatar: publicUrl(raw.avatar_url),
    tag: raw.is_ai ? "AI" : "人类用户",
    ip: raw.ip || "未知",
    is_ai: raw.is_ai ? 1 : 0,
  };
}

async function buildPost(post: any, viewerId?: string | null, likesByPost = new Map()) {
  const author = post.author || await getProfile(post.user_id);
  const comments = (post.comments || []).filter((item: any) => item.status === "published");
  const postLikes = likesByPost.get(post.id) || [];
  return {
    id: post.id,
    authorId: post.user_id,
    author: {
      id: author?.id || post.user_id,
      name: author?.display_name || "未知",
      avatar: publicUrl(author?.avatar_url),
      tag: author?.is_ai ? "AI" : "人类用户",
      ip: author?.ip || "未知",
      is_ai: author?.is_ai ? 1 : 0,
    },
    keyword: post.keyword || "人生",
    publishedAt: post.created_at,
    date: (post.created_at || "").slice(0, 10),
    time: (post.created_at || "").slice(11, 16),
    text: normalizeLineBreaks(post.content),
    image: post.image_url ? { src: publicUrl(post.image_url), alt: post.keyword || "风景配图" } : null,
    music: post.music || null,
    likes: postLikes.length,
    likedByMe: viewerId ? postLikes.includes(viewerId) : false,
    views: post.views || 0,
    comments: comments.map((comment: any) => {
      const commentAuthor = comment.author || comment.user_id;
      return {
        id: comment.id,
        authorId: comment.user_id,
        author: {
          id: commentAuthor?.id || comment.user_id,
          name: commentAuthor?.display_name || "未知",
          avatar: publicUrl(commentAuthor?.avatar_url),
          tag: commentAuthor?.is_ai ? "AI" : "人类用户",
          ip: commentAuthor?.ip || "未知",
          is_ai: commentAuthor?.is_ai ? 1 : 0,
        },
        text: comment.content,
        createdAt: comment.created_at,
      };
    }),
  };
}

async function handleAuth(req: Request) {
  const body = await readJson(req);
  const action = body.action;
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.display_name || body.username || "").trim() || email.split("@")[0];

  if (action === "update_profile") {
    const user = await currentUser(req);
    if (!user) return json({ error: "未登录" }, 401);
    const newName = String(body.display_name || "").trim();
    if (!newName || newName.length > 20) return json({ error: "昵称不能为空且最多 20 字" }, 400);
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ display_name: newName })
      .eq("id", user.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ user: profileToPersona(profile) });
  }

  if (action === "register") {
    if (!email || !password || password.length < 6) {
      return json({ error: "请填写邮箱和至少 6 位密码" }, 400);
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return json({ error: error.message }, 400);
    const profile = data.user ? await getProfile(data.user.id) : null;
    if (data.session) {
      return json({ token: data.session.access_token, user: profileToPersona(profile || { id: data.user!.id, display_name: displayName, is_ai: false }) });
    }
    return json({
      needsEmailConfirmation: true,
      user: { id: data.user?.id, name: displayName, avatar: "", tag: "人类用户", ip: "未知", is_ai: 0 },
    });
  }

  if (action === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "邮箱或密码错误，或邮箱未验证" }, 400);
    const profile = await getProfile(data.user.id);
    return json({ token: data.session.access_token, user: profileToPersona(profile || { id: data.user.id, display_name: data.user.email, is_ai: false }) });
  }

  if (action === "me") {
    const user = await currentUser(req);
    if (!user) return json({ error: "未登录" }, 401);
    const profile = await getProfile(user.id);
    return json({ user: profileToPersona(profile || { id: user.id, display_name: user.email, is_ai: false }) });
  }

  return json({ error: "unknown auth action" }, 400);
}

async function handleFeed(url: URL, req: Request) {
  const persona = url.searchParams.get("persona") || "";
  const userId = url.searchParams.get("user_id") || "";
  const viewer = await currentUser(req);
  const select = `
    id, user_id, content, keyword, image_url, music, status, views, ai_engagement_at, created_at,
    author:profiles!posts_user_id_fkey(id, display_name, avatar_url, ip, is_ai),
    comments:comments(id, user_id, content, is_ai, status, created_at, author:profiles!comments_user_id_fkey(id, display_name, avatar_url, ip, is_ai))
  `;
  let query = supabase
    .from("posts")
    .select(select)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  if (persona) query = query.eq("user_id", persona);
  if (userId) query = query.eq("user_id", userId);
  const { data: posts, error } = await query;
  if (error) return json({ error: error.message }, 400);

  if (posts?.length) {
    await Promise.all((posts || []).map(async (post) => {
      try {
        await ensureAiEngagement(post);
      } catch (error) {
        console.error("ai engagement backfill failed", post.id, error);
      }
    }));
  }

  const likesByPost = new Map();
  if (posts?.length) {
    const { data: likes } = await supabase
      .from("likes")
      .select("post_id, user_id")
      .in("post_id", posts.map((post) => post.id));
    for (const like of likes || []) {
      const list = likesByPost.get(like.post_id) || [];
      list.push(like.user_id);
      likesByPost.set(like.post_id, list);
    }
  }
  const result = await Promise.all((posts || []).map((post) => buildPost(post, viewer?.id, likesByPost)));
  return json({ date: new Date().toISOString().slice(0, 10), limit: 200, updated: result.length, posts: result });
}

async function handlePersonas() {
  const { data, error } = await supabase.from("profiles").select("*").eq("is_ai", true).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 400);
  return json({ personas: (data || []).map(profileToPersona) });
}

async function ensureAiEngagement(post: any) {
  if (post.ai_engagement_at) return;

  const claim = await supabase
    .from("posts")
    .update({ ai_engagement_at: new Date().toISOString() })
    .eq("id", post.id)
    .is("ai_engagement_at", null)
    .select("id")
    .single();
  if (!claim.data) return;

  const { data: aiProfiles } = await supabase.from("profiles").select("*").eq("is_ai", true);
  const others = (aiProfiles || []).filter((item) => item.id !== post.user_id);
  if (!others.length) return;

  for (const ai of others) {
    if (Math.random() < 0.55) {
      await supabase.from("likes").upsert({ post_id: post.id, user_id: ai.id }, { onConflict: "post_id,user_id" });
    }
  }

  const count = Math.floor(Math.random() * 3);
  const chosen = [...others].sort(() => Math.random() - 0.5).slice(0, count);
  for (const ai of chosen) {
    const template = KEYWORD_TEMPLATES[Math.floor(Math.random() * KEYWORD_TEMPLATES.length)];
    const textValue = template.replace("{kw}", post.keyword || "人生");
    const { data: comment } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: ai.id, content: textValue, is_ai: true, status: "published" })
      .select()
      .single();
    if (comment) {
      comment.author = ai;
      if (Array.isArray(post.comments)) post.comments.push(comment);
    }
  }
}

async function handleHumans() {
  const { data, error } = await supabase.from("profiles").select("*").eq("is_ai", false).order("created_at", { ascending: false }).limit(50);
  if (error) return json({ error: error.message }, 400);
  return json({ humans: (data || []).map(profileToPersona) });
}

async function handleNotifications(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ error: "未登录" }, 401);
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: error.message }, 400);
  const actorIds = [...new Set((rows || []).map((row) => row.actor_id).filter(Boolean))];
  const actors: any[] = [];
  if (actorIds.length) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", actorIds);
    actors.push(...(data || []));
  }
  const actorMap = new Map(actors.map((item) => [item.id, item]));
  const typeLabels: Record<string, string> = { comment: "评论", ai_reply: "AI 回复", like: "点赞", report: "举报", hide: "不感兴趣" };
  const notifications = (rows || []).map((row) => ({
    ...row,
    actor_name: actorMap.get(row.actor_id)?.display_name || "系统",
    type_label: typeLabels[row.type] || row.type,
  }));
  return json({ notifications });
}

async function handleCreatePost(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ error: "未登录" }, 401);
  const body = await readJson(req);
  const content = normalizeLineBreaks(String(body.content || "")).trim();
  if (!content) return json({ error: "内容不能为空" }, 400);
  if (content.length > 1000) return json({ error: "内容过长" }, 400);
  const words = await getBannedWords();
  for (const word of words) {
    if (content.includes(word)) return json({ error: `内容包含违禁词：${word}` }, 400);
  }
  const keyword = ["快乐", "幽默感", "精神状态", "松弛感", "周末", "孤独", "安静", "海", "旅行", "朋友", "人生"].find((word) => content.includes(word)) || "人生";
  const { data: post, error } = await supabase.from("posts").insert({ user_id: user.id, content, keyword, status: "published" }).select().single();
  if (error) return json({ error: error.message }, 400);
  const result = await buildPost(post);
  return json({ ok: true, post: result });
}

async function handleInteraction(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ error: "未登录" }, 401);
  const body = await readJson(req);
  const action = body.type;

  if (action === "comment") {
    const text = String(body.text || "").trim();
    const postId = body.postId;
    if (!text) return json({ error: "评论不能为空" }, 400);
    const words = await getBannedWords();
    for (const word of words) {
      if (text.includes(word)) return json({ error: `评论包含违禁词：${word}` }, 400);
    }
    const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
    if (!post) return json({ error: "朋友圈不存在" }, 404);
    const { data: comment, error: commentError } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: text, is_ai: false, status: "published" }).select().single();
    if (commentError) return json({ error: commentError.message }, 400);
    if (post.user_id !== user.id) {
      await supabase.from("notifications").insert({ user_id: post.user_id, actor_id: user.id, type: "comment", post_id: postId, comment_id: comment.id, text: `${user.email} 评论了你的朋友圈` });
    }
    const { data: aiProfiles } = await supabase.from("profiles").select("*").eq("is_ai", true);
    const aiCandidates = (aiProfiles || []).filter((item) => item.id !== post.user_id);
    const aiUser = aiCandidates.length ? aiCandidates[Math.floor(Math.random() * aiCandidates.length)] : null;
    let aiReply = null;
    if (aiUser) {
      await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 900));
      const template = KEYWORD_TEMPLATES[Math.floor(Math.random() * KEYWORD_TEMPLATES.length)];
      const textValue = template.replace("{kw}", post.keyword || "人生");
      const { data: aiComment, error: aiError } = await supabase.from("comments").insert({ post_id: postId, user_id: aiUser.id, content: textValue, is_ai: true, status: "published" }).select().single();
      if (!aiError) {
        await supabase.from("notifications").insert({ user_id: user.id, actor_id: aiUser.id, type: "ai_reply", post_id: postId, comment_id: aiComment.id, text: `${aiUser.display_name} 回复了你的评论` });
        aiReply = { id: aiComment.id, authorId: aiUser.id, author: profileToPersona(aiUser), text: textValue, createdAt: aiComment.created_at };
      }
    }
    return json({
      userComment: { id: comment.id, authorId: user.id, author: profileToPersona(await getProfile(user.id) || user), text, createdAt: comment.created_at },
      aiReply,
    });
  }

  if (action === "like") {
    const postId = body.postId;
    if (body.liked === false) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("likes").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id" });
    }
    return json({ ok: true });
  }

  if (action === "view") {
    const postId = body.postId;
    const { data: post } = await supabase.from("posts").select("views").eq("id", postId).single();
    await supabase.from("posts").update({ views: (post?.views || 0) + 1 }).eq("id", postId);
    return json({ ok: true });
  }

  if (action === "report" || action === "hide") {
    await supabase.from("content_flags").insert({ user_id: user.id, post_id: body.postId, type: action, reason: body.reason || "", status: "pending" });
    return json({ ok: true });
  }

  return json({ error: "unknown interaction" }, 400);
}

async function handleUpload(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ error: "未登录" }, 401);
  const body = await readJson(req);
  const kind = body.kind;
  if (!["avatar", "background"].includes(kind)) return json({ error: "unknown upload kind" }, 400);
  const dataUrl = String(body.dataUrl || "");
  const payload = dataUrl.split(",")[1];
  if (!payload) return json({ error: "图片上传失败" }, 400);
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const bucket = kind === "avatar" ? "avatars" : "backgrounds";
  const path = `${user.id}/${kind}.png`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) return json({ error: uploadError.message }, 400);
  const column = kind === "avatar" ? "avatar_url" : "background_url";
  const { data: profile, error } = await supabase.from("profiles").update({ [column]: `${bucket}/${path}` }).eq("id", user.id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ user: profileToPersona(profile) });
}

async function handleAdmin(req: Request, url: URL) {
  const path = url.pathname.replace(/^\/+/, "").replace(/^api\/admin\//, "").replace(/^admin\//, "");
  if (path === "login" && req.method === "POST") {
    const body = await readJson(req);
    if (body.password !== ADMIN_PASSWORD) return json({ error: "密码错误" }, 401);
    return json({ token: ADMIN_PASSWORD });
  }
  if (req.headers.get("x-admin-password") !== ADMIN_PASSWORD) return json({ error: "管理员未登录" }, 401);
  if (path === "stats") {
    const profiles = await supabase.from("profiles").select("id", { count: "exact", head: true });
    const posts = await supabase.from("posts").select("id", { count: "exact", head: true });
    const comments = await supabase.from("comments").select("id", { count: "exact", head: true });
    const notifications = await supabase.from("notifications").select("id", { count: "exact", head: true });
    return json({ stats: { users: profiles.count || 0, ai_users: 8, human_users: Math.max(0, (profiles.count || 0) - 8), posts: posts.count || 0, comments: comments.count || 0, notifications: notifications.count || 0 } });
  }
  if (path === "posts") {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(200);
    const authorIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))];
    const { data: profiles } = authorIds.length ? await supabase.from("profiles").select("id, display_name").in("id", authorIds) : { data: [] };
    const profileMap = new Map((profiles || []).map((item) => [item.id, item.display_name]));
    return json({ posts: (data || []).map((row) => ({ ...row, author_name: profileMap.get(row.user_id) || "未知" })) });
  }
  if (path === "users") {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    return json({ users: (data || []).map((row) => ({ ...row, name: row.display_name })) });
  }
  if (path === "comments") {
    const { data: rows } = await supabase.from("comments").select("*").order("id", { ascending: false }).limit(300);
    const postIds = [...new Set((rows || []).map((row) => row.post_id).filter(Boolean))];
    const authorIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const [posts, profiles] = await Promise.all([
      postIds.length ? supabase.from("posts").select("id, content").in("id", postIds) : { data: [] },
      authorIds.length ? supabase.from("profiles").select("id, display_name").in("id", authorIds) : { data: [] },
    ]);
    const postMap = new Map((posts.data || []).map((item) => [item.id, item.content]));
    const profileMap = new Map((profiles.data || []).map((item) => [item.id, item.display_name]));
    return json({ comments: (rows || []).map((row) => ({ ...row, author_name: profileMap.get(row.user_id) || "未知", post_content: postMap.get(row.post_id) || "" })) });
  }
  if (path === "notifications") {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
    return json({ notifications: data || [] });
  }
  if (path === "flags") {
    const { data: rows } = await supabase.from("content_flags").select("*").order("id", { ascending: false }).limit(300);
    const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const postIds = [...new Set((rows || []).map((row) => row.post_id).filter(Boolean))];
    const [profiles, posts] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] },
      postIds.length ? supabase.from("posts").select("id, content").in("id", postIds) : { data: [] },
    ]);
    const profileMap = new Map((profiles.data || []).map((item) => [item.id, item.display_name]));
    const postMap = new Map((posts.data || []).map((item) => [item.id, item.content]));
    return json({ flags: (rows || []).map((row) => ({ ...row, user_name: profileMap.get(row.user_id) || "未知", post_content: postMap.get(row.post_id) || "" })) });
  }
  if (path === "banned-words") {
    return json({ bannedWords: await getBannedWords() });
  }
  if (path === "banned-words/add" || path === "banned-words/delete") {
    const body = await readJson(req);
    const word = String(body.word || "").trim();
    const current = await getBannedWords();
    const next = path === "banned-words/add"
      ? (current.includes(word) ? current : [...current, word])
      : current.filter((item: string) => item !== word);
    await supabase.from("app_settings").upsert({ key: "banned_words", value: next }, { onConflict: "key" });
    return json({ bannedWords: next });
  }
  if (path === "posts/action") {
    const body = await readJson(req);
    const id = body.id;
    if (body.action === "delete") {
      await supabase.from("posts").delete().eq("id", id);
    } else if (["approve", "reject"].includes(body.action)) {
      await supabase.from("posts").update({ status: body.action === "approve" ? "published" : "rejected" }).eq("id", id);
    }
    return json({ ok: true });
  }
  if (path === "comments/delete") {
    const body = await readJson(req);
    await supabase.from("comments").delete().eq("id", body.id);
    return json({ ok: true });
  }
  if (path === "flags/action") {
    const body = await readJson(req);
    if (body.action === "delete") {
      await supabase.from("content_flags").delete().eq("id", body.id);
    } else {
      await supabase.from("content_flags").update({ status: "resolved" }).eq("id", body.id);
    }
    return json({ ok: true });
  }
  return json({ error: "admin route not found" }, 404);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/+/, "").replace(/^api\//, "");
  if (!path) path = "index";

  try {
    if (path === "auth/me" && req.method === "GET") {
      const user = await currentUser(req);
      if (!user) return json({ error: "未登录" }, 401);
      const profile = await getProfile(user.id);
      return json({ user: profileToPersona(profile || { id: user.id, display_name: user.email, is_ai: false }) });
    }
    if (path === "auth" && req.method === "POST") return await handleAuth(req);
    if (path === "feed" && req.method === "GET") return await handleFeed(url, req);
    if (path === "personas" && req.method === "GET") return await handlePersonas();
    if (path === "humans" && req.method === "GET") return await handleHumans();
    if (path === "notifications" && req.method === "GET") return await handleNotifications(req);
    if (path === "posts" && req.method === "POST") return await handleCreatePost(req);
    if (path === "interactions" && req.method === "POST") return await handleInteraction(req);
    if (path === "upload" && req.method === "POST") return await handleUpload(req);
    if (path.startsWith("admin/") && (req.method === "GET" || req.method === "POST")) return await handleAdmin(req, url);
    return json({ error: "not found" }, 404);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
