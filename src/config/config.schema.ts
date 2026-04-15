import { z } from 'zod';

export const globalConfigSchema = z.object({
  orgId: z.string().optional(),
  cloudOrgId: z.string().optional(),
  token: z.string().min(1, 'Токен обязателен'),
  tokenType: z.enum(['oauth', 'iam']).default('oauth'),
  defaultQueue: z.string().optional(),
  apiBaseUrl: z.string().url().default('https://api.tracker.yandex.net/v2'),
}).refine(
  data => data.orgId || data.cloudOrgId,
  { message: 'Укажите orgId или cloudOrgId' }
);

export const projectConfigSchema = z.object({
  queue: z.string().optional(),
  boardId: z.number().optional(),
  branchPrefix: z.string().default('feature'),
  statusMap: z.record(z.string()).default({
    open: 'open',
    inProgress: 'inProgress',
    review: 'readyForReview',
    testing: 'testing',
    closed: 'closed',
  }),
}).partial();

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export interface ResolvedConfig {
  token: string;
  tokenType: 'oauth' | 'iam';
  orgId?: string;
  cloudOrgId?: string;
  apiBaseUrl: string;
  queue?: string;
  boardId?: number;
  branchPrefix: string;
  statusMap: Record<string, string>;
}
