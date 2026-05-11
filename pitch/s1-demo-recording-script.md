# StreamPump S1 Demo Recording Script

Target length: 2-3 minutes
Recording path: `http://localhost:3000/demo`
Language: Chinese narration

## Narration

StreamPump 的 S1 是一个创作者发现市场。粉丝不是买可转让的 meme coin，而是用 SPUMP 支持早期创作者，获得产品内部记录的 S1 position。

这里从 demo hub 进入 S1 Market。页面左侧展示当前价格、价格走势、供应量、持有人数量、毕业进度和 supporter pool；右侧是粉丝的买卖操作区。

我先演示买入。选择 10 个 S1，确认之后，页面会在本地 demo 状态里完成提交，并更新当前持仓。这个流程对应真实产品里的交易构建、钱包签名、链上提交和 read model 同步。

接着切到卖出。S1 不是公开流通 token，所以卖出也是回到协议内的曲线退出，而不是二级市场撮合。确认卖出后，持仓和成本会同步变化。

当创作者接近毕业，赞助商可以发起 buyout。我们进入 Buyout Watch。这里能看到 accepted offer、winning sponsor、USDC deposited、claimable USDC，以及 rage quit deadline。

在 rage quit window 里，早期粉丝可以选择退出部分 S1 position；这个窗口保护粉丝在创作者进入赞助市场前重新定价风险。

最后演示 claim。毕业后，仍持有 eligible S1 position 的粉丝可以领取 pro-rata USDC。确认 claim 之后，claimable balance 清零，代表 buyout payout 已完成。

回到 Portfolio，可以看到 S1 持仓、claim queue 和 buyout 入口。完整的 S1 闭环是：发现创作者、建立 position、根据曲线调整仓位、进入 buyout、退出或领取 USDC。

## Operation Script

1. Open `http://localhost:3000/demo`.
2. Click `Open market` on the S1 Market card.
3. Pause on the market header, price chart, stats, buyout summary, and trade panel.
4. Click `Buy S1`.
5. Click `Confirm Buy S1`.
6. Pause on the success state and updated position.
7. Click the `Sell` tab.
8. Click amount chip `5`.
9. Click `Sell S1`.
10. Click `Confirm Sell S1`.
11. Pause on the success state and updated position.
12. Click `Buyout watch` in the S1 demo rail.
13. Pause on the phase stepper, offer metrics, sponsor offers, rage quit panel, and claim panel.
14. Click `Exit Position`.
15. Click `Confirm Exit Position`.
16. Pause on the success state and updated S1 balance.
17. Click `Claim`.
18. Click `Confirm Claim`.
19. Pause on the claimed state and claimable balance clearing.
20. Click `Portfolio` in the buyout path rail.
21. Pause on portfolio summary, S1 positions, claim queue, and buyout links.

## Recording Notes

- Keep the browser at desktop width.
- Avoid wallet connection popups by using the demo slugs.
- Do not say S1 buyout formation is fully productized; the current public demo starts from a seeded/operator-prepared buyout state.
- Keep Track 3 CPS and S2 settlement out of this S1-only recording unless a second demo is requested.
