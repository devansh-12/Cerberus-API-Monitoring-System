/**
 * Defines the event types used in the application for publishing and subscribing to events.
 * This module centralizes the event type definitions to ensure consistency across the application
 * and to provide a single source of truth for all event types. Each event type is represented
 * as a string constant that can be used when publishing events to RabbitMQ or when subscribing
 * to events in different parts of the application.
 */
export const EVENT_TYPES = {
  API_HIT: 'API_HIT',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
