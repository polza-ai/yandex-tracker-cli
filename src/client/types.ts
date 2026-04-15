export interface UserRef {
  self: string;
  id: string;
  display: string;
  login?: string;
}

export interface Status {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface Priority {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface Queue {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface Sprint {
  self: string;
  id: number;
  name?: string;
  display?: string;
  board?: BoardRef;
  status: 'draft' | 'in_progress' | 'closed';
  startDate?: string;
  endDate?: string;
}

export interface BoardRef {
  self: string;
  id: number;
  display: string;
}

export interface Issue {
  self: string;
  id: string;
  key: string;
  summary: string;
  description?: string;
  type: { self: string; id: string; key: string; display: string };
  status: Status;
  priority: Priority;
  queue: Queue;
  assignee?: UserRef;
  author?: UserRef;
  createdBy?: UserRef;
  sprint?: Sprint[];
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  storyPoints?: number;
  commentWithoutExternalMessageCount?: number;
  checklistDone?: number;
  checklistTotal?: number;
  tags?: string[];
}

export interface Transition {
  self: string;
  id: string;
  display: string;
  to: Status;
}

export interface Comment {
  self: string;
  id: number;
  text: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: UserRef;
  transport?: string;
}

export interface Worklog {
  self: string;
  id: number;
  issue: { self: string; id: string; key: string; display: string };
  duration: string;
  start: string;
  createdBy: UserRef;
  comment?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  assignee?: UserRef;
  deadline?: string;
}

export interface IssueLink {
  self: string;
  id: number;
  type: { self: string; id: string; inward: string; outward: string };
  direction: 'inward' | 'outward';
  object: { self: string; id: string; key: string; display: string };
  status: Status;
}

export interface QueueInfo {
  self: string;
  id: number;
  key: string;
  name: string;
  description?: string;
  lead?: UserRef;
  issueTypesConfig?: { issueType: { key: string; display: string } }[];
}

export interface CreateIssueParams {
  queue: string;
  summary: string;
  description?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  sprint?: number;
  parent?: string;
  tags?: string[];
}

export interface IssueFilter {
  queue?: string;
  assignee?: string;
  status?: string;
  sprint?: string;
  query?: string;
  includeClosed?: boolean;
  orderBy?: string;
}

export interface WorklogParams {
  duration: string;
  start?: string;
  comment?: string;
}
