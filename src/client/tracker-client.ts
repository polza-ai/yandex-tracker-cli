import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { createReadStream } from 'node:fs';
import { paginate, collectAll } from './pagination.js';
import type { Readable } from 'node:stream';
import type {
  Issue, Transition, Comment, Worklog, ChecklistItem,
  IssueLink, CreateIssueParams, IssueFilter, WorklogParams, Attachment,
  Sprint, UserRef, QueueInfo
} from './types.js';

export interface TrackerClientConfig {
  token: string;
  tokenType: 'oauth' | 'iam';
  orgId?: string;
  cloudOrgId?: string;
  apiBaseUrl?: string;
}

export class TrackerClient {
  private http: AxiosInstance;

  constructor(config: TrackerClientConfig) {
    const authHeader = config.tokenType === 'iam'
      ? `Bearer ${config.token}`
      : `OAuth ${config.token}`;

    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    if (config.cloudOrgId) {
      headers['X-Cloud-Org-ID'] = config.cloudOrgId;
    } else if (config.orgId) {
      headers['X-Org-ID'] = config.orgId;
    }

    this.http = axios.create({
      baseURL: config.apiBaseUrl ?? 'https://api.tracker.yandex.net/v2',
      headers,
      timeout: 30000,
    });

    this.http.interceptors.response.use(undefined, async (error: AxiosError) => {
      if (error.response?.status === 429 && error.config) {
        const retryAfter = parseInt(error.response.headers['retry-after'] as string ?? '2', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return this.http.request(error.config);
      }
      throw error;
    });
  }

  // Issues

  async getIssue(key: string): Promise<Issue> {
    const { data } = await this.http.get<Issue>(`/issues/${key}`);
    return data;
  }

  async searchIssues(filter: IssueFilter): Promise<Issue[]> {
    if (filter.query) {
      let query = filter.query;
      if (filter.orderBy) query += ` "Sort by": ${filter.orderBy}`;
      return collectAll(paginate<Issue>(this.http, '/issues/_search', {}, 'post', { query }));
    }

    const conditions: string[] = [];
    if (filter.queue) conditions.push(`Queue: "${filter.queue}"`);
    if (filter.assignee) {
      conditions.push(filter.assignee === 'me' ? 'Assignee: me()' : `Assignee: "${filter.assignee}"`);
    }
    if (filter.status) {
      conditions.push(`Status: "${filter.status}"`);
    } else if (!filter.includeClosed) {
      conditions.push('Resolution: empty()');
    }
    if (filter.sprint) conditions.push(`Sprint: "${filter.sprint}"`);

    let query = conditions.length > 0 ? conditions.join(' AND ') : '';
    if (filter.orderBy) query += ` "Sort by": ${filter.orderBy}`;

    return collectAll(paginate<Issue>(this.http, '/issues/_search', {}, 'post',
      query ? { query } : {}
    ));
  }

  async createIssue(params: CreateIssueParams): Promise<Issue> {
    const body: Record<string, unknown> = {
      queue: params.queue,
      summary: params.summary,
    };
    if (params.description) body.description = params.description;
    if (params.type) body.type = params.type;
    if (params.priority) body.priority = params.priority;
    if (params.assignee) body.assignee = params.assignee;
    if (params.sprint) body.sprint = [{ id: params.sprint }];
    if (params.parent) body.parent = params.parent;
    if (params.tags) body.tags = params.tags;

    const { data } = await this.http.post<Issue>('/issues', body);
    return data;
  }

  async updateIssue(key: string, params: Record<string, unknown>): Promise<Issue> {
    const { data } = await this.http.patch<Issue>(`/issues/${key}`, params);
    return data;
  }

  // Transitions

  async getTransitions(key: string): Promise<Transition[]> {
    const { data } = await this.http.get<Transition[]>(`/issues/${key}/transitions`);
    return data;
  }

  async executeTransition(key: string, transitionId: string, comment?: string): Promise<void> {
    const body = comment ? { comment } : undefined;
    await this.http.post(`/issues/${key}/transitions/${transitionId}/_execute`, body);
  }

  // Comments

  async getComments(key: string): Promise<Comment[]> {
    return collectAll(paginate<Comment>(this.http, `/issues/${key}/comments`));
  }

  async addComment(key: string, text: string): Promise<Comment> {
    const { data } = await this.http.post<Comment>(`/issues/${key}/comments`, { text });
    return data;
  }

  // Worklogs

  async getWorklogs(key: string): Promise<Worklog[]> {
    const { data } = await this.http.get<Worklog[]>(`/issues/${key}/worklog`);
    return data;
  }

  async addWorklog(key: string, params: WorklogParams): Promise<Worklog> {
    const { data } = await this.http.post<Worklog>(`/issues/${key}/worklog`, params);
    return data;
  }

  // Sprints

  async getSprints(boardId: number): Promise<Sprint[]> {
    const { data } = await this.http.get<Sprint[]>(`/boards/${boardId}/sprints`);
    return data;
  }

  async getCurrentSprint(boardId: number): Promise<Sprint | null> {
    const sprints = await this.getSprints(boardId);
    return sprints.find(s => s.status === 'in_progress') ?? null;
  }

  // Checklists

  async getChecklist(key: string): Promise<ChecklistItem[]> {
    const { data } = await this.http.get<ChecklistItem[]>(`/issues/${key}/checklistItems`);
    return Array.isArray(data) ? data : [];
  }

  async addChecklistItem(key: string, text: string): Promise<ChecklistItem> {
    const { data } = await this.http.post<ChecklistItem>(`/issues/${key}/checklistItems`, { text });
    return data;
  }

  async toggleChecklistItem(key: string, itemId: string, checked: boolean): Promise<void> {
    await this.http.patch(`/issues/${key}/checklistItems/${itemId}`, { checked });
  }

  // Links

  async getLinks(key: string): Promise<IssueLink[]> {
    const { data } = await this.http.get<IssueLink[]>(`/issues/${key}/links`);
    return data;
  }

  async createLink(key: string, target: string, relationship: string): Promise<IssueLink> {
    const { data } = await this.http.post<IssueLink>(`/issues/${key}/links`, {
      relationship,
      issue: target,
    });
    return data;
  }

  // Attachments

  async getAttachments(key: string): Promise<Attachment[]> {
    const { data } = await this.http.get<Attachment[]>(`/issues/${key}/attachments`);
    return data;
  }

  async uploadAttachment(key: string, filePath: string, filename: string): Promise<Attachment> {
    const { readFileSync } = await import('node:fs');
    const blob = new Blob([readFileSync(filePath)]);
    const form = new FormData();
    form.append('file', blob, filename);
    const { data } = await this.http.post<Attachment>(
      `/issues/${key}/attachments`,
      form,
    );
    return data;
  }

  async downloadAttachment(key: string, attachmentId: string): Promise<{ name: string; stream: Readable }> {
    const attachments = await this.getAttachments(key);
    const att = attachments.find(a => a.id === attachmentId);
    const name = att?.name ?? 'attachment';
    const { data } = await this.http.get(att?.content ?? `/attachments/${attachmentId}`, {
      responseType: 'stream',
    });
    return { name, stream: data as Readable };
  }

  // Queues

  async getQueues(): Promise<QueueInfo[]> {
    return collectAll(paginate<QueueInfo>(this.http, '/queues'));
  }

  // User

  async getMyself(): Promise<UserRef> {
    const { data } = await this.http.get<UserRef>('/myself');
    return data;
  }
}
