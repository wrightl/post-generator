"use client";

import { useEffect, useState } from "react";

type PostImageProps = {
  postId: number;
  /** When false, nothing is rendered. Use when post.imageUrl is set to avoid requesting when there is no image. */
  hasImage: boolean;
  className?: string;
  alt?: string;
};

/**
 * Fetches the post image via the API (with auth) and displays it.
 * Use instead of <img src={post.imageUrl} /> when image requires auth.
 */
export function PostImage({
  postId,
  hasImage,
  className,
  alt = "",
}: PostImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasImage) {
      setObjectUrl(null);
      setError(false);
      return;
    }

    let revoked = false;

    fetch(`/api/posts/${postId}/image`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setError(true);
          return;
        }
        return res.blob();
      })
      .then((blob) => {
        if (blob && !revoked) setObjectUrl(URL.createObjectURL(blob));
      })
      .catch(() => setError(true));

    return () => {
      revoked = true;
      setObjectUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    };
  }, [postId, hasImage]);

    if (!hasImage) return null;
    if (error || !objectUrl) return null;

    return <img src={objectUrl} alt={alt} className={className} />;
}
