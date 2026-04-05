# StreamPump User Surface UI Spec

## 1. 目标

这份文档只定义 **用户入口层（User Surface）** 的第一轮 UI 方向。

它不等于整个产品的全部前端规划。  
现阶段仅聚焦：

- 默认用户入口
- Explore 内容流
- Post Detail 图文/视频详情
- Trending Creators
- Creator Detail 三态页面

创作者工作区、MCN/赞助商企业入驻工作区在产品架构中存在，但不属于这份文档的第一轮落地范围。

## 2. 设计基调

整体视觉参考小红书 Web，但不是直接复制。

需要吸收的核心特征：

- 深色底
- 强内容优先
- 瀑布流卡片
- 评论和互动强存在感
- 页面层级简单
- 信息密度高，但不显得像后台

需要避免的方向：

- 不做交易所/行情终端视觉
- 不做区块链 debug panel
- 不做通用 SaaS dashboard
- 不做过度紫色、发光、AI 套壳感界面

## 3. 产品入口层结构

整个平台分为三层：

1. `User Surface`
   - 默认入口
   - 内容消费、发现、creator 跟踪、S1 market 理解

2. `Creator Surface`
   - 发内容
   - 管内容池
   - 做 S2 proposal / launch

3. `Business Surface`
   - MCN / Sponsor / Brand 入驻
   - 管 campaign
   - 管合作关系和企业侧视图

这三层属于同一产品，不是三个完全独立的网站。  
但现阶段优先设计和实现的是 `User Surface`。

## 4. User Surface 一级信息架构

### 左侧固定导航

- Explore
- Trending Creators
- Following
- Portfolio
- Notifications
- Me

### 顶部全局区域

- 搜索框
- 分类 tabs
- 右上角轻入口：
  - Creator Center
  - Business Entry

### 默认入口

默认选择 `Explore`。

## 5. Explore 页面

### 页面目标

把 StreamPump 做成“内容平台优先”的用户入口，而不是让用户一进来就看 creator market 面板。

### 布局

- 左侧：固定导航
- 顶部：搜索 + 分类 tabs
- 中间：瀑布流卡片 feed

### 内容卡片规则

卡片保持小红书式预览模式：

- 大封面
- 圆角卡片
- 标题/摘要
- 作者头像和昵称
- 点赞数
- 标签

如果帖子与 creator market 有关，可弱化显示一枚阶段提示：

- `S1`
- `S1 Buyout`
- `S2`

这个提示必须足够轻，不能像交易所标签。

### 分类 tabs

分类建议先做：

- 推荐
- 美妆
- 穿搭
- 游戏
- 健身
- 科技
- 城市
- 创作者观察

### 交互要求

- 卡片 hover 只有轻微抬升
- 不要在 feed 卡片上塞太多按钮
- 内容消费优先，交易信息后置

## 6. Post Detail 页面

Post Detail 分两种模式：

1. 普通图文帖
2. 视频帖

### 6.1 图文帖详情

参考小红书 Web 卡片详情。

#### 布局

- 左边：图片展示区
- 右边：评论区

#### 左侧图片区

- 支持多图切换
- 支持轮播点
- 大图沉浸展示

#### 右侧评论区

- 作者区
- Follow
- 标题
- 正文
- 标签
- 发布时间/地点
- 评论列表
- 底部输入框
- 点赞 / 收藏 / 评论 / 分享

#### 评论区要求

- 作者信息固定在上方
- 评论列表可独立滚动
- 底部操作栏固定
- 评论层级不复杂，优先可读性

### 6.2 视频帖详情

参考抖音 Web 端布局，但评论逻辑更接近小红书。

#### 布局

- 左边：大视频区
- 右边：评论与信息区

#### 视频区要求

- 黑底沉浸
- 支持上下滑切换视频
- 支持键盘上下切换
- 右侧浮动操作栏：
  - Like
  - Save
  - Share
  - Follow

#### 评论区要求

- 顶部可切换：
  - 详情
  - 评论
  - 相关推荐
- 默认进入评论
- 评论区不能抢走视频主体视觉

## 7. Trending Creators 页面

这是 Explore 之外的第二核心页面。

### 页面目标

让用户理解 creator 不只是内容账号，也是一个有成长阶段和市场状态的对象。

### 列表展示方式

采用卡片网格，而不是表格。

每张 creator 卡片展示：

- 头像 / 封面
- creator 名称
- 领域标签
- 当前阶段：
  - `S1`
  - `S1 Buyout`
  - `S2`
- 一句状态文案
- 一项关键指标

### 不同阶段的卡片信息

#### S1

- graduation progress 进度条
- 当前 token price
- momentum
- holder count 简版

#### S1 Buyout

- supporter distributable total
- sponsor offer value
- buyout window 状态
- 倒计时或进度状态

#### S2

- active campaign count
- activity score
- current valuation
- sponsor demand density

## 8. Creator Detail 页面

这个页面必须统一内容身份和 creator market 身份。

### 顶部 Hero

- creator 头像
- 名称
- 简介
- 标签
- Follow
- 当前阶段 badge

### 二级 tabs

- Posts
- Market
- Supporters
- Buyout / Campaigns

### 三种阶段页面重点

#### 8.1 S1

核心模块：

- Graduation progress
- Current token price
- Holder count
- Top 15 holders
- Bonding curve chart
- Target graduation price
- Potential buyout sponsors
- 近期内容 feed

目标：

让用户理解这是“成长中 creator”，不是单纯交易资产。

#### 8.2 S1 Buyout

核心模块：

- Buyout total value
- Supporter distributable amount
- Buyout window 状态
- 预计分配逻辑
- rage quit / claim 时间线
- sponsor 信息
- creator 后续去向

需要加入解释型模块：

- `What supporters receive`
- `What happens next`
- `Settlement timeline`

#### 8.3 S2

核心模块：

- Activity score
- Current valuation
- Active campaign count
- Content selection pool
- 历史 campaign 表现
- sponsor fit tags

这里的“内容选择池”是重点：

- 展示 creator 当前开放合作的内容方向
- 展示可被 sponsor 关注的内容池摘要

## 9. 交互语言要求

前端不要向普通用户直接暴露以下术语：

- PDA
- vault
- Anchor
- Borsh
- discriminator

推荐替换为：

- content binding
- creator growth curve
- launch state
- supporter payout
- confirmed on-chain

## 10. 视觉层要求

### 必须具备

- 深色基底
- 强卡片感
- 高可读评论区
- 强状态层次
- 内容和市场信息并置但不互相抢戏

### 明确不要

- 交易图表占据首页核心
- 指标过多导致内容感丢失
- 过度金融化
- 过度后台化

## 11. 现阶段设计实现范围

本轮设计和实现优先顺序：

1. Explore 页面
2. 图文帖详情页
3. 视频帖详情页
4. Trending Creators 页面
5. Creator Detail - S1
6. Creator Detail - S1 Buyout
7. Creator Detail - S2

## 12. 现阶段实现策略

由于当前后端对 S1 还没有完整的 read API，第一轮前端实现策略为：

- 用 mock domain data 先把用户面 UI 结构做对
- S2 已有稳定接口的部分后续再逐步接真数据
- S1 真实读模型后补，不阻塞第一轮视觉和交互设计
