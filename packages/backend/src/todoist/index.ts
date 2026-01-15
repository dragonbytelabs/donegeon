// Todoist v1 API Contract
// Main exports for the Todoist API integration

export * from './types.js';
export * from './client.js';

// Re-export commonly used types for convenience
export type {
  User,
  Project,
  Task,
  Section,
  Comment,
  Label,
  Filter,
  Reminder,
  DueDate,
  FileAttachment,
  PaginatedResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCommentRequest,
  CreateSectionRequest,
  CreateFilterRequest,
  ApiError,
  ActivityEvent,
  ProductivityStats,
} from './types.js';

export type {
  TaskApiClient,
  HttpClient,
  TaskApiConfig,
} from './client.js';