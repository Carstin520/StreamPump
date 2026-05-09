import type { GetStaticPropsResult } from "next";

import { PostRecord } from "@/lib/api/types";
import {
  extractPublicMediaOrigins,
  getPublicFeedPostById,
  listPublicFeedPosts,
} from "@/lib/api/feed";
import { posts as fallbackPublicFeedPosts } from "@/lib/mocks/discover";

export const PUBLIC_FEED_REVALIDATE_SECONDS = 60;
const PUBLIC_FEED_SSR_TIMEOUT_MS = 8000;

export type PublicFeedPageProps = {
  initialError: string | null;
  initialPosts: PostRecord[];
  mediaOrigins: string[];
};

export type PublicPostPageProps = {
  initialError: string | null;
  mediaOrigins: string[];
  post: PostRecord | null;
};

export const loadPublicFeedPageProps = async (): Promise<PublicFeedPageProps> => {
  try {
    const initialPosts = await listPublicFeedPosts({
      limit: 24,
      timeoutMs: PUBLIC_FEED_SSR_TIMEOUT_MS,
    });

    return {
      initialError: null,
      initialPosts,
      mediaOrigins: extractPublicMediaOrigins(initialPosts),
    };
  } catch (error) {
    const fallbackPosts = fallbackPublicFeedPosts.slice(0, 24);

    return {
      initialError:
        fallbackPosts.length > 0
          ? null
          : error instanceof Error
            ? error.message
            : "Failed to load public feed",
      initialPosts: fallbackPosts,
      mediaOrigins: extractPublicMediaOrigins(fallbackPosts),
    };
  }
};

export const loadPublicPostPageProps = async (
  postId: string
): Promise<PublicPostPageProps> => {
  try {
    const post = await getPublicFeedPostById(postId);

    return {
      initialError: null,
      mediaOrigins: extractPublicMediaOrigins([post]),
      post,
    };
  } catch (error) {
    return {
      initialError:
        error instanceof Error ? error.message : "Failed to load public post",
      mediaOrigins: [],
      post: null,
    };
  }
};

export const publicFeedNotFound = (): GetStaticPropsResult<never> => ({
  notFound: true,
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
