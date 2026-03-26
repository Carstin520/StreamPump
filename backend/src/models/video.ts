/**
 * CN: 旧版视频数据接口，描述脚手架 feed 中的视频对象。
 * EN: Legacy video data interface describing scaffold feed video objects.
 */
export type VideoStatus = "PENDING" | "GRADUATED";

export interface Video {
  id: string;
  creatorId: string;
  tempUrl: string;
  permanentUrl?: string;
  views: number;
  sparkDonations: number;
  status: VideoStatus;
  createdAt: Date;
  updatedAt: Date;
}
