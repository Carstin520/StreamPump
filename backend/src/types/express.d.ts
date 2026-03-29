/**
 * CN: Express 请求扩展，挂载钱包认证后的会话上下文。
 * EN: Express request augmentation that carries wallet-auth session context.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: {
        wallet: string;
        sessionId: string | null;
        source: "session" | "legacy-header";
      };
    }
  }
}

export {};
