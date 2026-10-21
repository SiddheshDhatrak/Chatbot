/** Appended to a normal-chat answer that was stopped mid-stream (saved by the server, shown by the client). */
export const STOPPED_MARKER = "\n\n_[Stopped]_";

/** Text to save/show for a stopped answer: the partial text plus the marker. */
export const withStoppedMarker = (partial: string) =>
  partial.trim() ? `${partial.trimEnd()}${STOPPED_MARKER}` : STOPPED_MARKER.trim();
