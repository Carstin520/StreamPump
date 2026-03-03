interface VideoPlayerProps {
  src?: string;
  creatorHandle?: string;
}

export const VideoPlayer = ({ src, creatorHandle = "@creator" }: VideoPlayerProps) => {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-xl">
      {src ? (
        <video className="h-full w-full object-cover" controls playsInline src={src} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/70">
          Feed preview placeholder
        </div>
      )}
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
        <p className="text-sm font-semibold">{creatorHandle}</p>
        <p className="text-xs text-white/80">Watch, submit clean signals, and back proposals with SPUMP.</p>
      </div>
    </div>
  );
};
