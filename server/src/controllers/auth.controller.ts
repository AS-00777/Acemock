import type { RequestHandler } from "express";
import { loginUser, registerUser } from "../services/auth.service";
import { ApiError } from "../middleware/error.middleware";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!name) throw new ApiError(400, "name is required");
    if (!email || !email.includes("@")) throw new ApiError(400, "valid email is required");
    if (!password || password.length < 8) throw new ApiError(400, "password must be at least 8 characters");

    const data = { name, email, password };
    const result = await registerUser(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!email || !email.includes("@")) throw new ApiError(400, "valid email is required");
    if (!password) throw new ApiError(400, "password is required");
    const data = { email, password };
    const result = await loginUser(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
