export function KickPlayer({
  channel,
  muted = false,
  remountKey,
  title,
}: {
  channel: string;
  muted?: boolean;
  remountKey?: number;
  title?: string;
}) {
  return (
    <div className="w-full h-full bg-black">
      <iframe
        key={remountKey}
        src={`https://player.kick.com/${channel}?muted=${muted ? 'true' : 'false'}`}
        height="100%"
        width="100%"
        allowFullScreen
        title={title ? `Kick stream: ${title}` : `Kick stream: ${channel}`}
        className="w-full h-full border-0"
      ></iframe>
    </div>
  );
}
