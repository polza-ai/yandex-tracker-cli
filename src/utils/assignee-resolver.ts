import type { TrackerClient } from '../client/tracker-client.js';
import type { ResolvedConfig } from '../config/config.schema.js';

export async function resolveAssignee(
  client: TrackerClient,
  config: ResolvedConfig,
  value: string | undefined,
): Promise<string | undefined> {
  if (!value) return value;
  if (value !== 'me') return value;
  if (config.userLogin) return config.userLogin;

  const myself = await client.getMyself();
  return myself.login ?? myself.id;
}
