import { useState, useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ImageUploadProps {
  /** Called with the uploaded image URL on success */
  onUpload: (url: string) => void;
  /** Optional custom upload endpoint (defaults to /api/upload) */
  endpoint?: string;
  /** Button class overrides */
  className?: string;
  /** Button size variant */
  size?: 'sm' | 'md';
}

export function ImageUpload({ onUpload, endpoint, className, size = 'sm' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use XMLHttpRequest for progress tracking
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const uploadUrl = endpoint ?? '/b3/api/upload';

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url ?? data.data?.url ?? '');
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        // Use the same base URL as our api client
        const baseUrl = (api as unknown as { baseUrl?: string }).baseUrl ?? '';
        xhr.open('POST', `${baseUrl}${uploadUrl}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      onUpload(url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={className ?? `p-1.5 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
        title="Upload image"
      >
        {uploading ? (
          <span className="flex items-center gap-1">
            <Loader2 className={`${iconSize} animate-spin`} />
            {progress > 0 && <span className="text-xs">{progress}%</span>}
          </span>
        ) : (
          <ImagePlus className={iconSize} />
        )}
      </button>
    </>
  );
}
