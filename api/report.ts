// Vercel function: POST /api/report (handled by the shared API in server/api.ts).
import { handleApi } from '../server/api.js';

export const POST = handleApi;
