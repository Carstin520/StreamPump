import type { GetStaticPropsResult } from "next";

import { PostRecord } from "@/lib/api/types";
import {
  extractPublicMediaOrigins,
  getPublicFeedPostById,
  listPublicFeedPosts,
} from "@/lib/api/feed";

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
  relatedPosts: PostRecord[];
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
    return {
      initialError:
        error instanceof Error ? error.message : "Failed to load public feed",
      initialPosts: [],
      mediaOrigins: [],
    };
  }
};

export const loadPublicPostPageProps = async (
  postId: string
): Promise<PublicPostPageProps> => {
  try {
    const post = await getPublicFeedPostById(postId);

    // Sibling posts power the detail "related" rail and up/down paging on the
    // standalone /posts/[postId] page (parity with the explore-modal experience).
    let relatedPosts: PostRecord[] = [];
    try {
      const feed = await listPublicFeedPosts({
        limit: 24,
        timeoutMs: PUBLIC_FEED_SSR_TIMEOUT_MS,
      });
      relatedPosts = feed.filter((item) => item.id !== post.id);
    } catch {
      relatedPosts = [];
    }

    return {
      initialError: null,
      mediaOrigins: extractPublicMediaOrigins([post, ...relatedPosts]),
      post,
      relatedPosts,
    };
  } catch (error) {
    return {
      initialError:
        error instanceof Error ? error.message : "Failed to load public post",
      mediaOrigins: [],
      post: null,
      relatedPosts: [],
    };
  }
};

export const publicFeedNotFound = (): GetStaticPropsResult<never> => ({
  notFound: true,
  revalidate: PUBLIC_FEED_REVALIDATE_SECONDS,
});
