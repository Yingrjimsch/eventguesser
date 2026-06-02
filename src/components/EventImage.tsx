import { useState } from "react";

type EventImageProps = {
  imageUrl: string;
  title?: string;
};

export function EventImage({ imageUrl, title }: EventImageProps) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (hasLoadError) {
    return (
      <div className="event-image-shell event-image-missing" role="alert">
        <strong>Event image missing</strong>
        <span>{imageUrl}</span>
      </div>
    );
  }

  return (
    <figure className="event-image-shell">
      <img
        src={imageUrl}
        alt={title ?? "Event scene"}
        onError={() => setHasLoadError(true)}
      />
      {title ? <figcaption>{title}</figcaption> : null}
    </figure>
  );
}
