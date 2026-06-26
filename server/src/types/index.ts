export type AuthedUser = {
  id: number;
  email: string;
  name: string;
  clerkId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export {};
