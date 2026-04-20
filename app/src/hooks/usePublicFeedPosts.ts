import { useEffect, useState } from "react";

import { PostRecord } from "@/lib/api/types";
import { listPublicFeedPosts } from "@/lib/api/feed";

type PublicFeedState = {
  error: string | null;
  loading: boolean;
  posts: PostRecord[];
};

const initialState: PublicFeedState = {
  error: null,
  loading: true,
  posts: [],
};

export const usePublicFeedPosts = () => {
  const [state, setState] = useState<PublicFeedState>(initialState);

  useEffect(() => {
    let active = true;

    setState(initialState);

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
          posts: [],
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
};
