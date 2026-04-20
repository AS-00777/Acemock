export {}; // 👈 THIS LINE IS CRITICAL

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email?: string;
      };
    }
  }
}