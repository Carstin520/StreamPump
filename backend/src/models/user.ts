/**
 * CN: 旧版用户数据接口，保留给原型接口使用。
 * EN: Legacy user data interface retained for prototype endpoints.
 */
export interface User {
  id: string;
  walletAddress: string;
  handle: string;
  createdAt: Date;
  updatedAt: Date;
}
