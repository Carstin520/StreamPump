import { useEffect, useState } from "react";

import { PostRecord } from "@/lib/api/types";
import { listPublicFeedPosts } from "@/lib/api/feed";

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
    return {
      error: initialError,
      loading: false,
      posts: [],
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

    void listPublicFeedPosts()
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

        setState({
          error: error instanceof Error ? error.message : "Failed to load public posts",
          loading: false,
          posts: nextInitialState.posts,
        });
      });

    return () => {
      active = false;
    };
  }, [options?.initialError, options?.initialPosts]);

  return state;
};
