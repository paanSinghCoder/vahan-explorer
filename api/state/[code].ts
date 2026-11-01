// Vercel function: GET /api/state/:code (handled by the shared API in server/api.ts).
import { handleApi } from '../../server/api.js';

export const GET = handleApi;
