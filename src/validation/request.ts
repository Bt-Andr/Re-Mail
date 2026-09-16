import type { Response } from 'express'
import { z, type ZodTypeAny } from 'zod'

export function parseRequest<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  res: Response
): z.infer<TSchema> | null {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  res.status(400).json({
    error: result.error.issues[0]?.message ?? 'Payload invalide.',
  })
  return null
}
