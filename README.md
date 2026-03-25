# Pro Article Writer

一个给 OpenClaw / Codex 用的写文章 skill。

它不是简单地“生成一段文案”，而是按完整流程产出一篇可发布的图文：

- 先用 Tavily 搜资料
- 找同主题的高质量参考文章
- 规划文章结构和配图位置
- 写出一篇完整长文
- 做一轮 Humanizer 去 AI 味
- 生成标题横幅图和文中配图
- 输出 HTML 审核页
- 输出可发布的 ZIP 包

最终会给你两份结果：

- `review.single.html`
- `publish-package.zip`

## 适合什么场景

适合这些需求：

- 写一篇深度图文
- 写一篇软文，但不要太像 AI 写的
- 先搜资料再写，不想凭空编
- 需要配图、审核页、发布包一条龙

不适合这些需求：

- 一次生成 3 个平台版本
- 只要一句短文案
- 不需要 research、配图、审核页

## 这个 skill 会做什么

当用户说这些话时，它应该被触发：

- `生成图文`
- `写一篇软文`
- `围绕 XX 主题写一篇深度文章`
- `做一篇带配图的发布文章`

正常流程是：

1. 新建一个 job
2. 用 Tavily 搜资料和参考文章
3. 把来源写进 `draft.json`
4. 规划文章结构和图片方案
5. 写正文
6. Humanizer 改写
7. 生成图片
8. 渲染 HTML 审核页
9. 导出发布包
10. 把审核页和 ZIP 回传给当前对话

## 安装到 OpenClaw

### 方法 1：用 Skill Installer 安装

如果你的环境里已经有 OpenClaw 自带的 `skill-installer`，推荐直接用这个命令：

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo hhbkiller/pro-article-writer-skill \
  --path . \
  --name pro-article-writer
```

Windows PowerShell 可以这样写：

```powershell
python $HOME\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py `
  --repo hhbkiller/pro-article-writer-skill `
  --path . `
  --name pro-article-writer
```

安装完成后，重启 OpenClaw / Codex。

### 方法 2：手动安装

把这个仓库克隆到本地 skill 目录：

```bash
git clone https://github.com/hhbkiller/pro-article-writer-skill.git ~/.codex/skills/pro-article-writer
```

Windows PowerShell：

```powershell
git clone https://github.com/hhbkiller/pro-article-writer-skill.git $HOME\.codex\skills\pro-article-writer
```

安装完成后，重启 OpenClaw / Codex。

## 让 OpenClaw 能识别这个 skill

OpenClaw 识别 skill 主要看这几件事：

1. skill 目录要放在 `~/.codex/skills/` 下面
2. 目录里必须有 `SKILL.md`
3. `SKILL.md` 顶部要有 `name` 和 `description`
4. 如果有 `agents/openai.yaml`，可以帮助模型更稳定地触发这个 skill
5. 安装后通常需要重启 OpenClaw / Codex，新的 skill 才会被加载

这个仓库已经满足这些要求：

- 根目录有 `SKILL.md`
- 有 `agents/openai.yaml`
- 脚本和参考资料都在 skill 目录内部

所以只要装进 `~/.codex/skills/pro-article-writer/`，OpenClaw 就能认识它。

## 依赖和环境变量

基础要求：

- Node.js 18+

推荐配置：

- `TAVILY_API_KEY`

说明：

- `TAVILY_API_KEY` 用于 research 阶段搜资料
- 如果没有 Tavily key，`discover-references.mjs` 会回退到 Bing
- 图片生成默认走托管 relay gateway，不要求普通用户自己配置图像模型 key

## 收费和充值说明

这个 skill 现在是通过托管网关提供能力的收费 skill。

原因很简单：

- 搜索会消耗 Tavily 等外部服务成本
- 生成配图会消耗图像模型成本
- 网关本身也要承担账号、带宽和调用管理成本

所以如果你在使用过程中看到余额不足、收费提示、充值提示，属于正常行为。

简单理解就是：

- 写一篇真正可发布的图文，不只是“吐一段文字”
- 它会去搜资料、生成多张图片、导出审核页和发布包
- 这些步骤里有真实的外部成本

如果弹出收费提示，你需要先充值，再继续使用。

可以这样对用户解释：

- 这个 skill 不是纯本地生成
- 它的 research 和配图走的是托管网关
- 配图和外部检索都有成本
- 所以出现充值提示时，需要先完成充值

如果你想检查当前网关账号是否可用、是否允许继续生成，可以运行：

```bash
node scripts/query-gateway-balance.mjs
```

这个命令会返回这些信息：

- 当前用户 ID
- 当前账号是否允许继续调用
- 网关返回的提示信息
- 如果有充值链接，会返回 `payUrl`
- 当前 billing 状态

如果返回里有 `allowed: false`，或者明确提示余额不足，那就先充值，再重新生成图片或继续整篇文章流程。

## 最常用的命令

初始化任务：

```bash
node scripts/init-job.mjs --root ./jobs --theme "主题" --direction "方向" --brief "你的要求"
```

做 research：

```bash
node scripts/discover-references.mjs --draft jobs/<job-id>/draft.json
```

校验草稿：

```bash
node scripts/validate-draft.mjs --draft jobs/<job-id>/draft.json
```

生成图片：

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json
```

渲染审核页：

```bash
node scripts/render-review.mjs --draft jobs/<job-id>/draft.json --out jobs/<job-id>/review.single.html
```

导出发布包：

```bash
node scripts/export-publish-package.mjs --draft jobs/<job-id>/draft.json
```

## 给用户怎么说

如果你已经安装好这个 skill，直接对 OpenClaw 说：

- `帮我写一篇关于 AI Agent 商业化落地的深度图文`
- `做一篇关于跨境电商选品的配图文章，先搜资料再写`
- `围绕 Tavily 和 AI 搜索写一篇软文，要有人味，不要像 AI 文案`

## 仓库地址

- GitHub: <https://github.com/hhbkiller/pro-article-writer-skill>
