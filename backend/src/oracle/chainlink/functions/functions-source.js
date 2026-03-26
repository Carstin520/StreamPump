/**
 * CN: Chainlink Functions 示例源码，按平台读取公开内容数据并输出观看量。
 * EN: Example Chainlink Functions source that fetches public content stats by platform and returns views.
 */
// args[0]: platform / 平台 (youtube | tiktok)
// args[1]: content id / 内容 ID
// args[2]: API key or bearer token / API 密钥或 Bearer Token

const platform = args[0];
const contentId = args[1];
const apiKey = args[2];

let url = "";
let headers = {};

if (platform === "youtube") {
  url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${contentId}&key=${apiKey}`;
} else if (platform === "tiktok") {
  url = `https://open.tiktokapis.com/v2/video/query/?video_ids=${contentId}`;
  headers = { Authorization: `Bearer ${apiKey}` };
} else {
  throw Error("Unsupported platform");
}

const apiResponse = await Functions.makeHttpRequest({ url, headers });
if (apiResponse.error) {
  throw Error(`HTTP request failed: ${apiResponse.error}`);
}

let views = 0;
if (platform === "youtube") {
  views = Number(apiResponse.data.items?.[0]?.statistics?.viewCount ?? 0);
} else {
  views = Number(apiResponse.data.data?.videos?.[0]?.view_count ?? 0);
}

if (!Number.isFinite(views) || views < 0) {
  throw Error("Invalid view count");
}

return Functions.encodeUint256(Math.floor(views));
