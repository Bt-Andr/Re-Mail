import 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        organizationId: string
        username: string
        orgRole: 'OWNER' | 'ADMIN' | 'MEMBER'
        nom?: string
      }
      rawBody?: Buffer
    }
  }
}
