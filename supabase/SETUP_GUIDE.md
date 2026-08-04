# Supabase 接入步骤

## 1. 执行数据库 SQL

打开 Supabase 项目，左侧点 `SQL Editor`，点 `New query`。

先打开并复制这个文件的内容：

```text
C:\Users\11527\Desktop\pyq\supabase\migrations\001_initial_schema.sql
```

粘贴到 SQL Editor，点 `Run`。

再新建一个 query，复制：

```text
C:\Users\11527\Desktop\pyq\supabase\migrations\002_storage_policies.sql
```

粘贴后点 `Run`。

## 2. 上传头像到 Storage

打开 Supabase 左侧 `Storage`，进入 `avatars` bucket。

上传这 8 个 AI 头像：

```text
C:\Users\11527\Desktop\pyq\static\assets\avatars\doubao.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\chatgpt.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\gemini.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\ernie.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\deepseek.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\kimi.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\grok.jpg
C:\Users\11527\Desktop\pyq\static\assets\avatars\claude.jpg
```

再把默认人类头像也传进去：

```text
C:\Users\11527\Desktop\pyq\static\assets\avatars\human.png
```

## 3. 上传风景壁纸到 Storage

打开 `Storage`，进入 `scenery` bucket。

上传这 19 张图：

```text
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-01.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-02.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-03.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-04.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-05.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-06.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-07.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-08.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-09.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-10.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-11.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-12.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-13.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-14.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-15.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-16.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-18.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-19.jpg
C:\Users\11527\Desktop\pyq\static\assets\images\scenery-20.jpg
```

## 4. 完成后告诉我

SQL 执行完、头像和风景图都传好后，回到 Codex 说一声“好了”，我继续接邮箱注册登录、Edge Function 和前端。
