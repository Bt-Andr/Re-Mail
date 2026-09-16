import { describe, expect, it } from 'vitest'
import {
  emailReplySchema,
  threadAssignmentSchema,
  threadBulkActionSchema,
  threadListQuerySchema,
  threadStarSchema,
  threadStatusSchema,
} from '../src/validation/schemas'

describe('shared request validation schemas', () => {
  it('normalizes a valid email payload and filters optional invalid recipients', () => {
    const parsed = emailReplySchema.parse({
      to: ' client@example.com ',
      cc: 'manager@example.com, invalid, manager@example.com',
      bcc: '',
      subject: 'Sujet',
      message: 'Bonjour',
      mode: 'reply',
    })

    expect(parsed.to).toBe('client@example.com')
    expect(parsed.cc).toEqual(['manager@example.com'])
    expect(parsed.bcc).toEqual([])
  })

  it('rejects a non-textual body and incomplete forward metadata', () => {
    expect(emailReplySchema.safeParse({ to: 'client@example.com', subject: 'Sujet', message: 42 }).success).toBe(false)
    expect(
      emailReplySchema.safeParse({
        to: 'client@example.com',
        subject: 'Sujet',
        message: 'Bonjour',
        mode: 'forward',
        threadId: 'thread-1',
      }).success
    ).toBe(false)
  })

  it('parses bounded pagination while rejecting forged query values', () => {
    const parsed = threadListQuerySchema.parse({ folder: 'inbox', take: '25', skip: '50' })
    expect(parsed.take).toBe(25)
    expect(parsed.skip).toBe(50)

    expect(threadListQuerySchema.safeParse({ take: ['10', '20'] }).success).toBe(false)
    expect(threadListQuerySchema.safeParse({ take: '101' }).success).toBe(false)
    expect(threadListQuerySchema.safeParse({ skip: '-1' }).success).toBe(false)
  })

  it('validates thread mutation payloads consistently', () => {
    expect(threadAssignmentSchema.safeParse({ assignedToId: null }).success).toBe(true)
    expect(threadAssignmentSchema.safeParse({}).success).toBe(false)
    expect(threadStatusSchema.safeParse({ status: 'resolu' }).success).toBe(true)
    expect(threadStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false)
    expect(threadStarSchema.safeParse({ starred: true }).success).toBe(true)
    expect(threadStarSchema.safeParse({ starred: 'true' }).success).toBe(false)
  })

  it('requires a bounded selection and at least one bulk mutation', () => {
    expect(threadBulkActionSchema.safeParse({ ids: ['thread-1'], archivedAt: true }).success).toBe(true)
    expect(threadBulkActionSchema.safeParse({ ids: ['thread-1'] }).success).toBe(false)
    expect(threadBulkActionSchema.safeParse({ ids: [], status: 'resolu' }).success).toBe(false)
    expect(threadBulkActionSchema.safeParse({ ids: Array.from({ length: 201 }, (_, index) => `thread-${index}`), status: 'resolu' }).success).toBe(false)
  })
})
