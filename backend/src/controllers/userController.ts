import { Request, Response } from "express";

export const getUserProfile = async (req: Request, res: Response) => {
  res.json({
    id: req.params.userId,
    handle: "creator_handle",
    walletAddress: "",
  });
};
