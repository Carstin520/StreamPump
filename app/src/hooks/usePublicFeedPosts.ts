import { useEffect, useState } from "react";

import { PostRecord } from "@/lib/api/types";
import { listPublicFeedPosts } from "@/lib/api/feed";
import { posts as fallbackPublicFeedPosts } from "@/lib/mocks/discover";

type PublicFeedState = {
  error: string | null;
  loading: boolean;
  posts: PostRecord[];
};

const emptyState: PublicFeedState = {
  error: null,
  loading: true,
  posts: [],
};

const getFallbackPosts = () => fallbackPublicFeedPosts.slice(0, 24);

const buildInitialState = (
  initialPosts?: PostRecord[],
  initialError?: string | null
): PublicFeedState => {
  if (initialPosts && initialPosts.length > 0) {
    return {
      error: initialError ?? null,
      loading: false,
      posts: initialPosts,
    };
  }

  if (initialError) {
    const fallbackPosts = getFallbackPosts();

    return {
      error: fallbackPosts.length > 0 ? null : initialError,
      loading: false,
      posts: fallbackPosts,
    };
  }

  return emptyState;
};

export const usePublicFeedPosts = (options?: {
  initialError?: string | null;
  initialPosts?: PostRecord[];
}) => {
  const [state, setState] = useState<PublicFeedState>(() =>
    buildInitialState(options?.initialPosts, options?.initialError)
  );

  useEffect(() => {
    let active = true;
    const nextInitialState = buildInitialState(
      options?.initialPosts,
      options?.initialError
    );

    setState((currentState) => {
      if (nextInitialState.loading) {
        return nextInitialState;
      }

      return {
        ...currentState,
        error: nextInitialState.error,
        posts: nextInitialState.posts,
      };
    });

    void listPublicFeedPosts({ timeoutMs: 8000 })
      .then((posts) => {
        if (!active) {
          return;
        }

        setState({
          error: null,
          loading: false,
          posts,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setState((currentState) => {
          const fallbackPosts =
            currentState.posts.length > 0
              ? currentState.posts
              : nextInitialState.posts.length > 0
                ? nextInitialState.posts
                : getFallbackPosts();

          return {
            error:
              fallbackPosts.length > 0
                ? null
                : error instanceof Error
                  ? error.message
                  : "Failed to load public posts",
            loading: false,
            posts: fallbackPosts,
          };
        });
      });

    return () => {
      active = false;
    };
  }, [options?.initialError, options?.initialPosts]);

  return state;
};
