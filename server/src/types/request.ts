import type { Request } from "express";
import type { AuthedUser } from "./index";

export interface AuthRequest extends Request {
  user?: AuthedUser;
}
