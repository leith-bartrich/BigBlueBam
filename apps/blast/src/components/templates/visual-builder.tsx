/**
 * Visual email template builder.
 *
 * Left sidebar: block palette (click to add).
 * Center: sortable block list with drag handles.
 * Right sidebar: property editor for the selected block.
 * Bottom: live HTML preview in three device widths.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Heading1,
  Type,
  ImageIcon,
  MousePointerClick,
  Minus,
  Columns3,
  Share2,
  ArrowUpDown,
  GripVertical,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  Code,
  Eye,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type EmailBlock, type BlockType, createBlock, PALETTE } from './block-types';
import { blocksToHtml } from './blocks-to-html';
import { BlockPropsEditor } from './block-props-editor';

/* ------------------------------------------------------------------
 * Icons mapping for block types
 * ------------------------------------------------------------------ */
const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  header: Heading1,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  columns: Columns3,
  social: Share2,
  spacer: ArrowUpDown,
};

/* ------------------------------------------------------------------
 * Sortable block item
 * ------------------------------------------------------------------ */
interface SortableBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function SortableBlock({ block, isSelected, onSelect, onRemove, onDuplicate }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = BLOCK_ICONS[block.type];

  // Brief label for the block
  const label = block.type === 'header' ? block.props.text.slice(0, 40) :
    block.type === 'text' ? 'Text block' :
    block.type === 'button' ? block.props.text :
    block.type === 'image' ? (block.props.alt || 'Image') :
    block.type.charAt(0).toUpperCase() + block.type.slice(1);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
        isSelected
          ? 'border-red-300 bg-red-50 ring-1 ring-red-200 dark:border-red-700 dark:bg-red-950/40 dark:ring-red-800'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none p-0.5 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">{label}</span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 text-zinc-400 hover:text-zinc-600" title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 text-zinc-400 hover:text-red-500" title="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Device preview widths
 * ------------------------------------------------------------------ */
type DeviceSize = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTHS: Record<DeviceSize, number> = { desktop: 600, tablet: 480, mobile: 320 };
const DEVICE_ICONS: Record<DeviceSize, LucideIcon> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

/* ------------------------------------------------------------------
 * Main builder
 * ------------------------------------------------------------------ */
interface VisualBuilderProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

export function VisualBuilder({ blocks, onChange }: VisualBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceSize>('desktop');
  const [showSource, setShowSource] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);
  const html = useMemo(() => blocksToHtml(blocks), [blocks]);

  const addBlock = useCallback(
    (type: BlockType) => {
      const block = createBlock(type);
      onChange([...blocks, block]);
      setSelectedId(block.id);
    },
    [blocks, onChange],
  );

  const removeBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [blocks, onChange, selectedId],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const original = blocks[idx]!;
      const dup = createBlock(original.type);
      // Copy props from original
      (dup as any).props = JSON.parse(JSON.stringify(original.props));
      const next = [...blocks];
      next.splice(idx + 1, 0, dup);
      onChange(next);
      setSelectedId(dup.id);
    },
    [blocks, onChange],
  );

  const updateBlock = useCallback(
    (updated: EmailBlock) => {
      onChange(blocks.map((b) => (b.id === updated.id ? updated : b)));
    },
    [blocks, onChange],
  );

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = blocks.findIndex((b) => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= blocks.length) return;
      onChange(arrayMove(blocks, idx, newIdx));
    },
    [blocks, onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIdx, newIdx));
    },
    [blocks, onChange],
  );

  return (
    <div className="flex h-full">
      {/* ── Left: Builder controls ── */}
      <div className="flex flex-col w-1/2 min-w-0 border-r border-zinc-200 dark:border-zinc-700">
        {/* Block palette (horizontal strip) + block list + props below */}
        <div className="flex flex-1 min-h-0">
          {/* Block palette */}
          <div className="w-40 shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto p-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Add Block</p>
            <div className="space-y-1">
              {PALETTE.map((item) => {
                const Icon = BLOCK_ICONS[item.type];
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => addBlock(item.type)}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Block list (sortable) */}
          <div className="flex-1 overflow-y-auto p-3">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
                <Type className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs font-medium">No blocks yet</p>
                <p className="text-[10px] mt-1">Click a block type on the left</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {blocks.map((block) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        isSelected={block.id === selectedId}
                        onSelect={() => setSelectedId(block.id === selectedId ? null : block.id)}
                        onRemove={() => removeBlock(block.id)}
                        onDuplicate={() => duplicateBlock(block.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Properties panel (bottom of left pane) */}
        {selectedBlock && (
          <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-700 overflow-y-auto p-3" style={{ maxHeight: '40%' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {selectedBlock.type} Properties
              </p>
              <div className="flex gap-0.5">
                <button type="button" onClick={() => moveBlock(selectedBlock.id, -1)} className="p-1 text-zinc-400 hover:text-zinc-600" title="Move up">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveBlock(selectedBlock.id, 1)} className="p-1 text-zinc-400 hover:text-zinc-600" title="Move down">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <BlockPropsEditor block={selectedBlock} onChange={updateBlock} />
          </div>
        )}
      </div>

      {/* ── Right: Live preview ── */}
      <div className="flex flex-col w-1/2 min-w-0">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-1">
            {(Object.keys(DEVICE_WIDTHS) as DeviceSize[]).map((size) => {
              const Icon = DEVICE_ICONS[size];
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPreviewDevice(size)}
                  className={`p-1.5 rounded-md transition-colors ${
                    previewDevice === size
                      ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                      : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title={size.charAt(0).toUpperCase() + size.slice(1)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <span className="ml-2 text-xs text-zinc-400">{DEVICE_WIDTHS[previewDevice]}px</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSource(false)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md ${!showSource ? 'bg-zinc-200 dark:bg-zinc-700 font-medium' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <Eye className="h-3 w-3" /> Preview
            </button>
            <button
              type="button"
              onClick={() => setShowSource(true)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md ${showSource ? 'bg-zinc-200 dark:bg-zinc-700 font-medium' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              <Code className="h-3 w-3" /> HTML
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto flex justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
          {showSource ? (
            <pre className="w-full overflow-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300 font-mono">
              {html}
            </pre>
          ) : (
            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 self-start"
              style={{ width: DEVICE_WIDTHS[previewDevice], maxWidth: '100%' }}
            >
              <iframe
                srcDoc={html}
                className="w-full border-0"
                style={{ minHeight: 600 }}
                sandbox="allow-same-origin"
                title="Email preview"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
