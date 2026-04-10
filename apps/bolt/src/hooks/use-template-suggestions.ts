import { useMemo } from 'react';
import { useEventCatalog, type EventDef } from '@/hooks/use-event-catalog';
import type { TriggerSource } from '@/hooks/use-automations';

// ─── Types ────────────────────────────────────────────────────────────

export interface TemplateSuggestion {
  /** Dotted path WITHOUT surrounding braces, e.g. "event.task.id". */
  path: string;
  /** Short type label displayed as a badge in the popup. */
  type: string;
  /** Human description displayed under the path. */
  description: string;
  /** Grouping key used by the popup to render section headers. */
  category: 'event' | 'actor' | 'automation' | 'system' | 'step';
}

// ─── Static suggestions (always available) ───────────────────────────

const ACTOR_SUGGESTIONS: TemplateSuggestion[] = [
  { path: 'actor.id', type: 'uuid', description: 'User who triggered the event', category: 'actor' },
  { path: 'actor.email', type: 'string', description: 'Email of the triggering user', category: 'actor' },
  { path: 'actor.name', type: 'string', description: 'Display name of the triggering user', category: 'actor' },
];

const AUTOMATION_SUGGESTIONS: TemplateSuggestion[] = [
  { path: 'automation.id', type: 'uuid', description: 'Current automation ID', category: 'automation' },
  { path: 'automation.name', type: 'string', description: 'Current automation name', category: 'automation' },
];

const SYSTEM_SUGGESTIONS: TemplateSuggestion[] = [
  { path: 'now', type: 'datetime', description: 'Current ISO timestamp at run time', category: 'system' },
];

// ─── Event payload → suggestions ─────────────────────────────────────

function payloadToSuggestions(event: EventDef): TemplateSuggestion[] {
  return event.payload_schema.map((field) => ({
    // payload_schema names are already dotted paths like "task.id".
    // Prefix with "event." to form the full template reference.
    path: `event.${field.name}`,
    type: field.type,
    description: `${field.description} — from ${event.event_type}`,
    category: 'event' as const,
  }));
}

/**
 * Union of payload fields across multiple events, de-duplicated by path.
 * When a field appears in more than one event, we keep the first entry
 * (rare in practice; the payload_schemas are quite consistent within a source).
 */
function unionEvents(events: EventDef[]): TemplateSuggestion[] {
  const seen = new Map<string, TemplateSuggestion>();
  for (const evt of events) {
    for (const suggestion of payloadToSuggestions(evt)) {
      if (!seen.has(suggestion.path)) {
        seen.set(suggestion.path, suggestion);
      }
    }
  }
  return Array.from(seen.values());
}

// ─── Public hook ─────────────────────────────────────────────────────

export interface UseTemplateSuggestionsOptions {
  triggerSource?: TriggerSource;
  triggerEvent?: string;
  /** Number of preceding action steps (for step[N].result.* suggestions). */
  stepCount?: number;
}

/**
 * Returns all `{{ ... }}` template suggestions available in the current
 * automation-editor context. Event-payload suggestions are narrowed to the
 * selected event_type when one is chosen, and fall back to the union of all
 * events for the selected source otherwise. When nothing is selected yet, only
 * the non-event suggestions (actor, automation, now, step[N].result) are
 * returned so the autocomplete still works while the user is in early editing.
 */
export function useTemplateSuggestions({
  triggerSource,
  triggerEvent,
  stepCount = 0,
}: UseTemplateSuggestionsOptions): TemplateSuggestion[] {
  const { data } = useEventCatalog();
  const allEvents = data?.data ?? [];

  return useMemo(() => {
    // Event-payload suggestions
    let eventSuggestions: TemplateSuggestion[] = [];
    if (triggerSource) {
      const sourceEvents = allEvents.filter((e) => e.source === triggerSource);
      if (triggerEvent) {
        const exact = sourceEvents.find((e) => e.event_type === triggerEvent);
        if (exact) {
          eventSuggestions = payloadToSuggestions(exact);
        } else {
          // Unknown event type — offer the union as fallback
          eventSuggestions = unionEvents(sourceEvents);
        }
      } else {
        eventSuggestions = unionEvents(sourceEvents);
      }
    }

    // Step[N].result references — generic, since we don't know the shape of
    // each MCP tool's response ahead of time. Users can still dot into the
    // result object by hand once the suggestion is inserted.
    const stepSuggestions: TemplateSuggestion[] = [];
    for (let i = 0; i < stepCount; i++) {
      stepSuggestions.push({
        path: `step[${i}].result`,
        type: 'any',
        description: `Result from action step ${i + 1}`,
        category: 'step',
      });
    }

    return [
      ...eventSuggestions,
      ...ACTOR_SUGGESTIONS,
      ...AUTOMATION_SUGGESTIONS,
      ...SYSTEM_SUGGESTIONS,
      ...stepSuggestions,
    ];
  }, [allEvents, triggerSource, triggerEvent, stepCount]);
}
