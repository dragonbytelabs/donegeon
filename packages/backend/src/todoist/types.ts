// Todoist v1 API Types
// Based on https://developer.todoist.com/api/v1/

// ================ CORE ENTITIES ================

export interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;
  verification_status: 'unverified' | 'verified' | 'blocked' | 'legacy';
  mfa_enabled: boolean;
  token: string;
  is_premium: boolean;
  premium_status?: 'not_premium' | 'current_personal_plan' | 'legacy_personal_plan' | 'teams_business_member';
  premium_until?: string;
  free_trial_expires?: string;
  has_started_a_trial: boolean;
  joined_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  business_account_id?: string;
  date_format: number;
  time_format: number;
  sort_order: number;
  theme_id: string;
  start_day: number;
  weekend_start_day: number;
  next_week: number;
  auto_reminder: number;
  start_page: string;
  inbox_project_id: string;
  lang: string;
  tz_info: {
    gmt_string: string;
    hours: number;
    is_dst: number;
    minutes: number;
    timezone: string;
  };
  karma: number;
  karma_trend: string;
  daily_goal: number;
  weekly_goal: number;
  days_off: number[];
  is_celebrations_enabled: boolean;
  completed_count: number;
  completed_today: number;
  share_limit: number;
  features: Record<string, any>;
  feature_identifier: string;
  joinable_workspace?: any;
  onboarding_completed: boolean;
  onboarding_initiated: boolean;
  onboarding_started: boolean;
  onboarding_level: string;
  onboarding_persona: string;
  onboarding_role: string;
  onboarding_team_mode: string;
  onboarding_use_cases: string[];
  getting_started_guide_projects: string[];
  activated_user: boolean;
  has_magic_number: boolean;
  image_id?: string;
  avatar_big?: string;
  avatar_medium?: string;
  avatar_s640?: string;
  avatar_small?: string;
  websocket_url?: string;
}

export interface Project {
  id: string;
  can_assign_tasks: boolean;
  child_order: number;
  color: string;
  creator_uid: string;
  created_at: string;
  is_archived: boolean;
  is_deleted: boolean;
  is_favorite: boolean;
  is_frozen: boolean;
  name: string;
  updated_at: string;
  view_style: string;
  default_order: number;
  description?: string;
  public_key?: string;
  access?: {
    visibility: 'restricted' | 'team' | 'public';
    configuration?: any;
  };
  role?: string;
  parent_id?: string;
  inbox_project: boolean;
  is_collapsed: boolean;
  is_shared: boolean;
  // Workspace-specific fields
  workspace_id?: string;
  is_invite_only?: boolean;
  is_link_sharing_enabled?: boolean;
  collaborator_role_default?: string;
  status?: string;
  is_pending_default_collaborator_invites?: boolean;
}

export interface Task {
  user_id: string;
  id: string;
  project_id: string;
  section_id?: string;
  parent_id?: string;
  added_by_uid: string;
  assigned_by_uid?: string;
  responsible_uid?: string;
  labels: string[];
  deadline?: {
    date: string;
    lang: string;
  };
  duration?: {
    amount: number;
    unit: 'minute' | 'day';
  };
  checked: boolean;
  is_deleted: boolean;
  added_at: string;
  completed_at?: string;
  completed_by_uid?: string;
  updated_at: string;
  due?: DueDate;
  priority: number;
  child_order: number;
  content: string;
  description: string;
  note_count: number;
  day_order: number;
  is_collapsed: boolean;
}

export interface Section {
  id: string;
  user_id: string;
  project_id: string;
  added_at: string;
  updated_at: string;
  archived_at?: string;
  name: string;
  section_order: number;
  is_archived: boolean;
  is_deleted: boolean;
  is_collapsed: boolean;
}

export interface Comment {
  id: string;
  posted_uid: string;
  content: string;
  file_attachment?: FileAttachment;
  uids_to_notify: string[];
  is_deleted: boolean;
  posted_at: string;
  reactions?: Record<string, string[]>;
  // Task-specific
  item_id?: string;
  // Project-specific
  project_id?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

export interface Filter {
  id: string;
  name: string;
  query: string;
  color: string;
  item_order: number;
  is_deleted: boolean;
  is_favorite: boolean;
  is_frozen: boolean;
}

export interface Reminder {
  id: string;
  notify_uid: string;
  item_id: string;
  type: 'relative' | 'absolute' | 'location';
  due?: DueDate;
  minute_offset?: number;
  name?: string;
  loc_lat?: string;
  loc_long?: string;
  loc_trigger?: 'on_enter' | 'on_leave';
  radius?: number;
  is_deleted: boolean;
}

// ================ DUE DATES ================

export interface DueDate {
  date: string;
  timezone?: string | null;
  string: string;
  lang: string;
  is_recurring: boolean;
}

// ================ FILE ATTACHMENTS ================

export interface FileAttachment {
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  upload_state?: string;
  // Image-specific
  tn_l?: [string, number, number];
  tn_m?: [string, number, number];
  tn_s?: [string, number, number];
  image?: string;
  image_width?: number;
  image_height?: number;
  // Audio-specific
  file_duration?: number;
}

// ================ PAGINATION ================

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor?: string;
}

// ================ API REQUEST/RESPONSE TYPES ================

// Task API
export interface CreateTaskRequest {
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number;
  assignee_id?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
  duration?: number;
  duration_unit?: 'minute' | 'day';
  deadline_date?: string;
}

export interface UpdateTaskRequest {
  content?: string;
  description?: string;
  labels?: string[];
  priority?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
  assignee_id?: number | null;
  duration?: number | null;
  duration_unit?: 'minute' | 'day' | null;
  deadline_date?: string | null;
}

export interface MoveTaskRequest {
  project_id?: string;
  section_id?: string;
  parent_id?: string;
}

// Project API
export interface CreateProjectRequest {
  name: string;
  description?: string;
  parent_id?: string | number;
  color?: string;
  is_favorite?: boolean;
  view_style?: string;
  workspace_id?: string | number;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
  is_favorite?: boolean;
  view_style?: string;
}

// Comment API
export interface CreateCommentRequest {
  content: string;
  project_id?: string;
  task_id?: string;
  attachment?: FileAttachment;
  uids_to_notify?: string[];
}

// Section API
export interface CreateSectionRequest {
  name: string;
  project_id: string;
  order?: number;
}

// Filter API
export interface CreateFilterRequest {
  name: string;
  query: string;
  color?: string;
  item_order?: number;
  is_favorite?: boolean;
}

// ================ ERROR TYPES ================

export interface ApiError {
  error: string;
  error_code: number;
  error_extra?: Record<string, any>;
  error_tag: string;
  http_code: number;
}

// ================ ACTIVITY LOG ================

export interface ActivityEvent {
  object_type: string;
  object_id: string;
  v2_object_id: string;
  event_type: string;
  event_date: string;
  id: number;
  parent_project_id?: string;
  v2_parent_project_id?: string;
  parent_item_id?: string;
  v2_parent_item_id?: string;
  initiator_id?: string;
  extra_data_id?: number;
  extra_data?: any;
  source: string;
}

// ================ PRODUCTIVITY STATS ================

export interface ProductivityStats {
  days_items: Array<{
    date: string;
    items: Array<{
      id: string;
      completed: number;
    }>;
    total_completed: number;
  }>;
  week_items: Array<{
    from: string;
    to: string;
    items: Array<{
      id: string;
      completed: number;
    }>;
    total_completed: number;
  }>;
  project_colors: Record<string, string>;
  completed_count: number;
  karma: number;
  karma_trend: string;
  karma_graph_data: Array<{
    date: string;
    karma_avg: number;
  }>;
  karma_last_update: number;
  karma_update_reasons: Array<{
    time: string;
    new_karma: number;
    positive_karma: number;
    negative_karma: number;
    positive_karma_reasons: number[];
    negative_karma_reasons: number[];
  }>;
  goals: {
    user: string;
    user_id: string;
    daily_goal: number;
    weekly_goal: number;
    ignore_days: number[];
    vacation_mode: number;
    karma_disabled: number;
    current_daily_streak: {
      count: number;
      start: string;
      end: string;
    };
    current_weekly_streak: {
      count: number;
      start: string;
      end: string;
    };
    last_daily_streak: {
      count: number;
      start: string;
      end: string;
    };
    last_weekly_streak: {
      count: number;
      start: string;
      end: string;
    };
    max_daily_streak: {
      count: number;
      start: string;
      end: string;
    };
    max_weekly_streak: {
      count: number;
      start: string;
      end: string;
    };
  };
}

// ================ COMPLETED TASKS ================

export interface CompletedTasksByCompletionDateRequest {
  since: string; // ISO 8601 date-time
  until: string; // ISO 8601 date-time
  workspace_id?: string | number;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  filter_query?: string;
  filter_lang?: string;
  cursor?: string;
  limit?: number;
  public_key?: string;
}

export interface CompletedTasksByDueDateRequest {
  since: string; // ISO 8601 date-time
  until: string; // ISO 8601 date-time
  workspace_id?: string | number;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  filter_query?: string;
  filter_lang?: string;
  cursor?: string;
  limit?: number;
}

// ================ QUICK ADD ================

export interface QuickAddTaskRequest {
  text: string;
  note?: string;
  reminder?: string;
  auto_reminder?: boolean;
  meta?: boolean;
}

// ================ UPLOADS ================

export interface UploadFileRequest {
  file: File;
  project_id?: string;
}

export interface UploadResponse {
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  resource_type: string;
  image?: string;
  image_width?: number;
  image_height?: number;
  upload_state: string;
}

// ================ COLORS ================

export const PROJECT_COLORS = {
  30: { name: 'berry_red', hex: '#B8255F' },
  31: { name: 'red', hex: '#DC4C3E' },
  32: { name: 'orange', hex: '#C77100' },
  33: { name: 'yellow', hex: '#B29104' },
  34: { name: 'olive_green', hex: '#949C31' },
  35: { name: 'lime_green', hex: '#65A33A' },
  36: { name: 'green', hex: '#369307' },
  37: { name: 'mint_green', hex: '#42A393' },
  38: { name: 'teal', hex: '#148FAD' },
  39: { name: 'sky_blue', hex: '#319DC0' },
  40: { name: 'light_blue', hex: '#6988A4' },
  41: { name: 'blue', hex: '#4180FF' },
  42: { name: 'grape', hex: '#692EC2' },
  43: { name: 'violet', hex: '#CA3FEE' },
  44: { name: 'lavender', hex: '#A4698C' },
  45: { name: 'magenta', hex: '#E05095' },
  46: { name: 'salmon', hex: '#C9766F' },
  47: { name: 'charcoal', hex: '#808080' },
  48: { name: 'grey', hex: '#999999' },
  49: { name: 'taupe', hex: '#8F7A69' },
} as const;

export type ProjectColorId = keyof typeof PROJECT_COLORS;
export type ProjectColorName = typeof PROJECT_COLORS[ProjectColorId]['name'];

// ================ FILTER QUERY TYPES ================

export interface TaskFilterRequest {
  query: string;
  lang?: string;
  cursor?: string;
  limit?: number;
}

// ================ ID MAPPINGS ================

export interface IdMapping {
  old_id: string;
  new_id: string;
}

export type ObjectType = 'sections' | 'tasks' | 'comments' | 'reminders' | 'location_reminders' | 'projects';

// ================ USER PLAN LIMITS ================

export interface UserPlanLimits {
  current: UserPlanInfo;
  next?: UserPlanInfo;
}

export interface UserPlanInfo {
  plan_name: string;
  activity_log: boolean;
  activity_log_limit: number;
  automatic_backups: boolean;
  calendar_feeds: boolean;
  comments: boolean;
  completed_tasks: boolean;
  custom_app_icon: boolean;
  customization_color: boolean;
  email_forwarding: boolean;
  filters: boolean;
  max_filters?: number;
  workspace_filters: boolean;
  max_workspace_filters?: number;
  labels: boolean;
  max_labels?: number;
  reminders: boolean;
  max_reminders_location?: number;
  max_reminders_time?: number;
  templates: boolean;
  uploads: boolean;
  upload_limit_mb: number;
  weekly_trends: boolean;
  max_projects?: number;
  max_sections?: number;
  max_tasks?: number;
  max_collaborators?: number;
}