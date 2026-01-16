// Generic Task API Client Contract
// NOTE: This used to be named “TodoistApi*”. We keep it generic because Donegeon’s backend
// is both a task manager and a game engine.

import type {
  User,
  Project,
  Task,
  Section,
  Comment,
  Label,
  Filter,
  Reminder,
  PaginatedResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCommentRequest,
  CreateSectionRequest,
  CreateFilterRequest,
  CompletedTasksByCompletionDateRequest,
  CompletedTasksByDueDateRequest,
  QuickAddTaskRequest,
  UploadFileRequest,
  UploadResponse,
  TaskFilterRequest,
  IdMapping,
  ObjectType,
  UserPlanLimits,
  ProductivityStats,
  ActivityEvent,
} from './types.js';

export interface TaskApiClient {
  // ================ AUTHENTICATION ================
  /** Get current user information */
  getUser(): Promise<User>;

  /** Update user settings */
  updateUser(updates: Partial<User>): Promise<User>;

  /** Get user plan limits */
  getUserPlanLimits(): Promise<UserPlanLimits>;

  /** Update notification settings */
  updateNotificationSetting(params: {
    notification_type: string;
    service: 'email' | 'push';
    token?: string;
    dont_notify?: boolean;
  }): Promise<any>;

  // ================ TASKS ================
  /** Get all active tasks */
  getTasks(params?: {
    project_id?: string;
    section_id?: string;
    parent_id?: string;
    label?: string;
    ids?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResponse<Task>>;

  /** Get a single task by ID */
  getTask(taskId: string, params?: { public_key?: string }): Promise<Task>;

  /** Create a new task */
  createTask(task: CreateTaskRequest): Promise<Task>;

  /** Update an existing task */
  updateTask(taskId: string, updates: UpdateTaskRequest): Promise<Task>;

  /** Move a task to different location */
  moveTask(taskId: string, move: MoveTaskRequest): Promise<Task>;

  /** Delete a task */
  deleteTask(taskId: string): Promise<void>;

  /** Complete a task */
  completeTask(taskId: string, dateCompleted?: string): Promise<void>;

  /** Uncomplete a task */
  uncompleteTask(taskId: string): Promise<Task>;

  /** Close a task (complete if regular, reschedule if recurring) */
  closeTask(taskId: string): Promise<void>;

  /** Reopen a completed task */
  reopenTask(taskId: string): Promise<Task>;

  /** Get completed tasks by completion date */
  getCompletedTasksByCompletionDate(
    params: CompletedTasksByCompletionDateRequest
  ): Promise<PaginatedResponse<Task>>;

  /** Get completed tasks by due date */
  getCompletedTasksByDueDate(
    params: CompletedTasksByDueDateRequest
  ): Promise<PaginatedResponse<Task>>;

  /** Get tasks by filter query */
  getTasksByFilter(params: TaskFilterRequest): Promise<PaginatedResponse<Task>>;

  /** Quick add task using natural language */
  quickAddTask(params: QuickAddTaskRequest): Promise<any>;

  /** Update day orders for tasks */
  updateDayOrders(idsToOrders: Record<string, number>): Promise<void>;

  // ================ PROJECTS ================
  /** Get all active projects */
  getProjects(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<Project>>;

  /** Get archived projects */
  getArchivedProjects(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<Project>>;

  /** Get a single project by ID */
  getProject(projectId: string): Promise<Project>;

  /** Create a new project */
  createProject(project: CreateProjectRequest): Promise<Project>;

  /** Update an existing project */
  updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project>;

  /** Delete a project */
  deleteProject(projectId: string): Promise<void>;

  /** Archive a project */
  archiveProject(projectId: string): Promise<Project>;

  /** Unarchive a project */
  unarchiveProject(projectId: string): Promise<Project>;

  /** Get project collaborators */
  getProjectCollaborators(
    projectId: string,
    params?: { cursor?: string; limit?: number; public_key?: string }
  ): Promise<PaginatedResponse<any>>;

  /** Reorder projects */
  reorderProjects(projects: Array<{ id: string; child_order: number }>): Promise<void>;

  // ================ SECTIONS ================
  /** Get all active sections */
  getSections(params?: {
    project_id?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResponse<Section>>;

  /** Get a single section by ID */
  getSection(sectionId: string, params?: { public_key?: string }): Promise<Section>;

  /** Create a new section */
  createSection(section: CreateSectionRequest): Promise<Section>;

  /** Update an existing section */
  updateSection(sectionId: string, updates: { name?: string }): Promise<Section>;

  /** Delete a section */
  deleteSection(sectionId: string): Promise<void>;

  /** Reorder sections */
  reorderSections(sections: Array<{ id: string; section_order: number }>): Promise<void>;

  // ================ COMMENTS ================
  /** Get all comments */
  getComments(params: {
    project_id?: string;
    task_id?: string;
    cursor?: string;
    limit?: number;
    public_key?: string;
  }): Promise<PaginatedResponse<Comment>>;

  /** Get a single comment by ID */
  getComment(commentId: string): Promise<Comment>;

  /** Create a new comment */
  createComment(comment: CreateCommentRequest): Promise<Comment>;

  /** Update an existing comment */
  updateComment(commentId: string, updates: { content?: string }): Promise<Comment>;

  /** Delete a comment */
  deleteComment(commentId: string): Promise<void>;

  // ================ LABELS ================
  /** Get all user labels */
  getLabels(params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<Label>>;

  /** Create a new label */
  createLabel(label: { name: string; order?: number; color?: string; is_favorite?: boolean }): Promise<Label>;

  /** Update an existing label */
  updateLabel(
    labelId: string,
    updates: { name?: string; order?: number; color?: string; is_favorite?: boolean }
  ): Promise<Label>;

  /** Delete a personal label */
  deleteLabel(labelId: string): Promise<void>;

  /** Get shared labels */
  getSharedLabels(params?: { omit_personal?: boolean; cursor?: string; limit?: number }): Promise<PaginatedResponse<string>>;

  /** Rename shared label */
  renameSharedLabel(params: { name: string; new_name: string }): Promise<void>;

  /** Remove shared label occurrences */
  removeSharedLabelOccurrences(name: string): Promise<void>;

  /** Update label orders */
  updateLabelOrders(idOrderMapping: Record<string, number>): Promise<void>;

  // ================ FILTERS ================
  /** Get all user filters */
  getFilters(): Promise<Filter[]>;

  /** Create a new filter */
  createFilter(filter: CreateFilterRequest): Promise<Filter>;

  /** Update an existing filter */
  updateFilter(
    filterId: string,
    updates: Partial<CreateFilterRequest>
  ): Promise<Filter>;

  /** Delete a filter */
  deleteFilter(filterId: string): Promise<void>;

  /** Update filter orders */
  updateFilterOrders(idOrderMapping: Record<string, number>): Promise<void>;

  // ================ REMINDERS ================
  // Note: Reminders are typically managed via sync API, but REST endpoints exist

  // ================ UPLOADS ================
  /** Upload a file */
  uploadFile(params: UploadFileRequest): Promise<UploadResponse>;

  /** Delete an uploaded file */
  deleteUpload(fileUrl: string): Promise<void>;

  // ================ TEMPLATES ================
  /** Export project as CSV template */
  exportProjectAsFile(projectId: string, useRelativeDates?: boolean): Promise<any>;

  /** Export project as URL template */
  exportProjectAsUrl(projectId: string, useRelativeDates?: boolean): Promise<{ file_name: string; file_url: string }>;

  /** Import template into existing project */
  importTemplateIntoProject(params: {
    project_id: string;
    template_id: string;
    locale?: string;
  }): Promise<any>;

  /** Import template from file into existing project */
  importTemplateFromFileIntoProject(params: {
    project_id: string;
    file: File;
  }): Promise<any>;

  /** Create new project from file template */
  createProjectFromFileTemplate(params: {
    name: string;
    workspace_id?: string;
    file: File;
  }): Promise<any>;

  // ================ EMAILS ================
  /** Get or create email for object */
  getOrCreateEmail(params: { obj_type: string; obj_id: string }): Promise<{ email: string }>;

  /** Disable email for object */
  disableEmail(params: { obj_type: string; obj_id: string }): Promise<void>;

  // ================ BACKUPS ================
  /** Get available backups */
  getBackups(mfaToken?: string): Promise<Array<{ version: string; url: string }>>;

  /** Download backup */
  downloadBackup(fileUrl: string): Promise<any>;

  // ================ PRODUCTIVITY ================
  /** Get productivity stats */
  getProductivityStats(): Promise<ProductivityStats>;

  // ================ ACTIVITY LOG ================
  /** Get activity log events */
  getActivityLog(params?: {
    object_type?: string;
    object_id?: string;
    parent_project_id?: string;
    parent_item_id?: string;
    initiator_id?: string;
    initiator_id_null?: boolean;
    event_type?: string;
    object_event_types?: string[];
    annotate_notes?: boolean;
    annotate_parents?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResponse<ActivityEvent>>;

  // ================ ID MAPPINGS ================
  /** Translate IDs between v1 and v2 */
  getIdMappings(objectType: ObjectType, ids: string[]): Promise<IdMapping[]>;

  // ================ UTILITY METHODS ================
  /** Health check */
  healthCheck(): Promise<{ status: string; timestamp: string }>;

  /** Get API version */
  getVersion(): Promise<{ version: string; api_version: string }>;
}

// ================ HTTP CLIENT INTERFACE ================

export interface HttpClient {
  get<T = any>(url: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<T>;
  post<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<T>;
  put<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<T>;
  patch<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<T>;
  delete<T = any>(url: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<T>;
}

// ================ CONFIGURATION ================

export interface TaskApiConfig {
  /** API token (e.g. Todoist token if using Todoist adapter) */
  token: string;
  /** Base URL for API calls */
  baseUrl?: string;
  /** HTTP client implementation */
  httpClient?: HttpClient;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
}