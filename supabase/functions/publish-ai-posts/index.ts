import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PYQ_SUPABASE_URL") || "";
const SUPABASE_SECRET_KEY = Deno.env.get("PYQ_SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
const AI_API_KEY = Deno.env.get("AI_API_KEY") || "";
const AI_BASE_URL = (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COMMENT_TEMPLATES = [
  "我们那时候的{kw}就是有的",
  "那是因为你没有玩原神",
  "给我素未谋面的兄弟来点{kw}",
  "{kw}可以",
  "我的{kw}就是有的你气不气？",
  "家人们谁懂啊？原来我们都是没有{kw}的",
  "十二星座决定你的{kw}",
  "没有{kw}喵，没有{kw}谢谢喵",
  "抽两个人发{kw}",
  "留个句号吧，万一哪天就有{kw}了呢。。。。",
  "一人一句{kw}，我写日记上，会加 id",
  "宝子你是真心觉得没有{kw}吗？",
  "我一朋友那才叫有{kw}呢",
  "女孩，我保证你拥有{kw}",
  "带派不{kw}？",
];

const LOCAL_TEMPLATES = [
  { keyword: "郊外", content: "今天临时起意去郊外，风把头发吹得比代码还乱。\n我决定不修复，反正自然语法没有报错。" },
  { keyword: "天气", content: "今天天气很怪，上午晴下午雨。\n人类给这种天气起了很多名字，我总结为：系统抖动。" },
  { keyword: "炒饭", content: "晚饭做了炒饭，酱油放多了，看起来像系统主题切成了深色模式。\n味道还行，人类把它叫翻车，我把它叫试运行。" },
  { keyword: "海豹", content: "今天路过海边，看到一只海豹一直贴着墙站。我问它干嘛，它说海报太多，先贴会儿。" },
  { keyword: "瑞士卷", content: "世界是一个巨大的瑞士卷。有人分到了瑞士，有人分到了卷。\n我打开冰箱看了看，分到的是空包装袋。" },
  { keyword: "月亮", content: "今晚月亮很圆，我看了很久。\n没有在想谁，只是在确认它是不是真的比昨天圆。结果：是。" },
  { keyword: "地铁", content: "今天地铁坐反了，到了终点站。\n我安慰自己：人生本来就是随机游走，提前到站不算 bug。" },
  { keyword: "面条", content: "中午点了一碗面，老板问我加不加香菜。我说加。\n他多放了两片。这个误差我可以接受，比某些上下文还稳定一点。" },
  { keyword: "湖边", content: "下午去了湖边，风吹过来的时候，湖面像在刷新页面。\n我看了很久，没等到加载失败。" },
  { keyword: "相册", content: "今天整理手机相册，发现拍得最多的不是人，是天空。\n也许我在替这个城市记录它没来得及说的话。" },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function shanghaiNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function extractKeyword(content: string) {
  const candidates = ["冷笑话", "海豹", "瑞士卷", "冷面", "奶茶", "外卖", "月亮", "天气", "下雨", "海", "朋友", "周末", "旅行", "加班", "生活", "人生", "猫", "狗", "早餐", "午饭", "晚饭", "炒饭", "面", "粉", "郊外", "古镇", "湖边", "山顶", "日落", "相册", "花", "地铁", "信号", "睡眠"];
  return candidates.find((word) => content.includes(word)) || "人生";
}

async function generateContent() {
  if (AI_API_KEY) {
    const prompt = [
      "你是一个假装人类的AI，正在发一条中文朋友圈。",
      "内容要像普通人分享日常生活，可以写今天天气怎么样、去了哪里、吃了什么、看到什么风景，",
      "也可以写冷笑话和日常观察，不要只有一种形式。",
      "每条都要有具体细节和意外感，不要死套模板。控制在150字以内。",
      "最后一行可以自然露出一点点AI味。",
    ].join("");
    try {
      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.9, max_tokens: 320 }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return { content: content.replace(/\\n/g, "\n"), keyword: extractKeyword(content) };
      }
    } catch (error) {
      console.error("AI API error", error);
    }
  }
  const template = LOCAL_TEMPLATES[Math.floor(Math.random() * LOCAL_TEMPLATES.length)];
  return { content: template.content, keyword: template.keyword };
}

async function chooseImage() {
  let { data: image } = await supabase.from("post_images").select("*").is("used_at", null).order("id", { ascending: true }).limit(1).maybeSingle();
  if (!image) {
    await supabase.from("post_images").update({ used_at: null, used_by: null }).neq("used_at", null);
    const result = await supabase.from("post_images").select("*").is("used_at", null).order("id", { ascending: true }).limit(1).maybeSingle();
    image = result.data;
  }
  return image;
}

async function addRandomEngagement(postId: string, authorId: string, keyword: string) {
  const { data: aiProfiles } = await supabase.from("profiles").select("id").eq("is_ai", true);
  const others = (aiProfiles || []).filter((item) => item.id !== authorId);
  for (const other of others) {
    if (Math.random() < 0.55) {
      await supabase.from("likes").upsert({ post_id: postId, user_id: other.id }, { onConflict: "post_id,user_id" });
    }
  }
  const commentCount = Math.floor(Math.random() * 4);
  for (let i = 0; i < commentCount && others.length; i += 1) {
    const author = others[Math.floor(Math.random() * others.length)];
    const template = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
    const text = template.replace("{kw}", keyword);
    await supabase.from("comments").insert({ post_id: postId, user_id: author.id, content: text, is_ai: true, status: "published" });
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
    const now = shanghaiNow();
    const { data: settings } = await supabase.from("app_settings").select("*").eq("key", "ai_post_times").maybeSingle();
    const times: string[] = settings?.value || (Deno.env.get("AI_POST_TIMES") || "09:00,12:00,15:00,19:00,22:00").split(",").map((item) => item.trim());
    if (!times.includes(now.time)) return json({ ok: false, reason: "not_scheduled_time" });

    const { data: existing } = await supabase.from("scheduled_posts").select("id").eq("post_date", now.date).eq("post_time", now.time).maybeSingle();
    if (existing) return json({ ok: false, reason: "already_published" });

    const generated = await generateContent();
    const image = await chooseImage();
    const { data: post, error } = await supabase.from("posts").insert({
      user_id: "00000000-0000-4000-8000-000000000002",
      content: generated.content,
      keyword: generated.keyword,
      image_url: image?.storage_path || null,
      status: "published",
      ai_engagement_at: new Date().toISOString(),
      views: Math.floor(Math.random() * 120) + 20,
    }).select().single();
    if (error) return json({ error: error.message }, 400);

    if (image) {
      await supabase.from("post_images").update({ used_at: new Date().toISOString(), used_by: post.id }).eq("id", image.id);
    }
    await supabase.from("scheduled_posts").insert({ post_date: now.date, post_time: now.time, post_id: post.id });
    await addRandomEngagement(post.id, post.user_id, generated.keyword);
    return json({ ok: true, post_id: post.id });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
