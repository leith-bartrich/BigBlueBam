import { useMemo } from 'react';

interface CursorData {
  x: number;
  y: number;
  color: string;
  name: string;
}

interface CursorOverlayProps {
  cursors: Map<string, CursorData>;
  appState: { scrollX: number; scrollY: number; zoom: { value: number } };
}

/**
 * Renders remote collaborator cursors as an overlay on top of the Excalidraw canvas.
 * Scene coordinates are converted to screen coordinates using the current viewport.
 */
export function CursorOverlay({ cursors, appState }: CursorOverlayProps) {
  const entries = useMemo(() => Array.from(cursors.entries()), [cursors]);

  if (entries.length === 0) return null;

  const { scrollX, scrollY, zoom } = appState;
  const z = zoom?.value ?? 1;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none', zIndex: 199 }}
    >
      {entries.map(([userId, cursor]) => {
        const screenX = (cursor.x + scrollX) * z;
        const screenY = (cursor.y + scrollY) * z;

        return (
          <div
            key={userId}
            className="absolute transition-transform duration-100 ease-out"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
            }}
          >
            {/* Arrow cursor SVG */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M4 2L4 16L8.5 12L14 18L16 16L10 10L16 10L4 2Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-4 top-4 rounded px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
