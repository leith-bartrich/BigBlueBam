import clsx from 'clsx';

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  className?: string;
}

export function ScreenshotFrame({ src, alt, className }: ScreenshotFrameProps) {
  return (
    <div className={clsx('overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl', className)}>
      <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-100 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 rounded-md bg-zinc-200/70 px-3 py-1 text-center text-[11px] text-zinc-400">
          bigbluebam.app
        </div>
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}
