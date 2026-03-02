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
