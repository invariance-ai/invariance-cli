/**
 * api-types contract test (CLI-001).
 *
 * Asserts that fixtures matching `@invariance/api-types` interfaces
 * parse cleanly through the CLI's hand-rolled Zod schemas in
 * `src/types/index.ts`. Drift produces a Zod error here in CI instead
 * of a runtime crash for users.
 *
 * Currently todo: needs `@invariance/api-types` installable as a workspace
 * dep (or a generated fixture committed to this repo).
 */
import { describe, expect, it } from 'vitest';
import { WorkflowEventSchema, WorkflowDefinitionSchema } from '../types/index.js';

describe('api-types contract: CLI Zod schemas', () => {
  // Field-set tripwires: Zod `.object()` strips unknown keys on parse, so a
  // server field the schema forgets is silently dropped. Pin the expected key
  // sets (mirrored from @invariance/api-types) so additions/removals fail here.
  it('WorkflowEvent schema declares exactly the server response fields', () => {
    expect(Object.keys(WorkflowEventSchema.shape).sort()).toEqual([
      'actor_id',
      'actor_type',
      'agent_id',
      'case_id',
      'created_at',
      'end_user_id',
      'evidence_node_ids',
      'evidence_refs',
      'id',
      'idempotency_key',
      'occurred_at',
      'payload',
      'tags',
      'tenant_id',
      'type',
    ]);
  });

  it('WorkflowDefinition schema declares exactly the server response fields', () => {
    expect(Object.keys(WorkflowDefinitionSchema.shape).sort()).toEqual([
      'agent_id',
      'allowed_outcomes',
      'created_at',
      'custom_metrics',
      'description',
      'display_name',
      'expected_fields',
      'expected_steps',
      'key',
      'spec_level',
      'stale_after_hours',
      'updated_at',
    ]);
  });

  it('WorkflowEvent fixture parses with tags', () => {
    const fixture = {
      id: 'workflow_event_3',
      case_id: 'case_1',
      agent_id: 'agt_1',
      tenant_id: null,
      end_user_id: null,
      type: 'support.escalated',
      actor_type: null,
      actor_id: null,
      payload: {},
      evidence_node_ids: [],
      evidence_refs: [],
      tags: ['vip', 'urgent'],
      occurred_at: '2026-05-21T10:00:00.000Z',
      created_at: '2026-05-21T10:00:01.000Z',
    };
    expect(WorkflowEventSchema.parse(fixture).tags).toEqual(['vip', 'urgent']);
  });

  it('WorkflowEvent fixture parses with idempotency_key present', () => {
    const fixture = {
      id: 'workflow_event_1',
      case_id: 'case_1',
      agent_id: 'agt_1',
      tenant_id: 'tenant_1',
      end_user_id: 'cust_42',
      type: 'refund.issued',
      actor_type: 'human',
      actor_id: 'agent_smith',
      payload: { amount_usd: 42 },
      evidence_node_ids: ['node_a'],
      evidence_refs: [{ kind: 'ticket', id: 'ZD-1001' }],
      idempotency_key: 'ext-evt-1',
      occurred_at: '2026-05-21T10:00:00.000Z',
      created_at: '2026-05-21T10:00:01.000Z',
    };
    expect(WorkflowEventSchema.parse(fixture).idempotency_key).toBe('ext-evt-1');
  });

  it('WorkflowEvent fixture parses with idempotency_key null and when omitted', () => {
    const base = {
      id: 'workflow_event_2',
      case_id: 'case_1',
      agent_id: 'agt_1',
      tenant_id: null,
      end_user_id: null,
      type: 'approval.approved',
      actor_type: null,
      actor_id: null,
      payload: {},
      evidence_node_ids: [],
      evidence_refs: [],
      occurred_at: '2026-05-21T10:00:00.000Z',
      created_at: '2026-05-21T10:00:01.000Z',
    };
    expect(() => WorkflowEventSchema.parse({ ...base, idempotency_key: null })).not.toThrow();
    expect(() => WorkflowEventSchema.parse(base)).not.toThrow();
  });

  it.todo('Run fixture conforming to @invariance/api-types parses through RunSchema');
  it.todo('Node fixture parses through NodeSchema');
  it.todo('Monitor fixture parses through MonitorSchema');
  it.todo('Signal fixture parses through SignalSchema');
  it.todo('Finding fixture parses through FindingSchema');
  it.todo('Review fixture parses through ReviewSchema');
  it.todo('Severity union matches platform Severity exactly');
});
