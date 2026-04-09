import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { boards } from './boards.js';

export const boardElements = pgTable(
  'board_elements',
  {
    id: uuid('id').primaryKey(),
    board_id: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    element_type: varchar('element_type', { length: 30 }),
    text_content: text('text_content'),
    x: doublePrecision('x').default(0).notNull(),
    y: doublePrecision('y').default(0).notNull(),
    width: doublePrecision('width'),
    height: doublePrecision('height'),
    rotation: doublePrecision('rotation').default(0).notNull(),
    color: varchar('color', { length: 20 }),
    font_size: varchar('font_size', { length: 10 }),
    frame_id: uuid('frame_id'),
    group_id: uuid('group_id'),
    arrow_start: jsonb('arrow_start'),
    arrow_end: jsonb('arrow_end'),
    arrow_label: text('arrow_label'),
    embed_type: varchar('embed_type', { length: 20 }),
    embed_ref_id: uuid('embed_ref_id'),
    embed_url: varchar('embed_url', { length: 2048 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_board_elements_board_id').on(table.board_id),
    index('idx_board_elements_element_type').on(table.element_type),
    index('idx_board_elements_frame_id').on(table.frame_id),
    // Note: GIN fulltext index on text_content is created in the SQL migration
    // as Drizzle ORM does not natively support to_tsvector GIN indexes.
  ],
);
