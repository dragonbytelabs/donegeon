# @donegeon/backend

Hono-based API server for Donegeon with Todoist v1 API integration.

## Overview

This package provides:

- **Todoist API Contract**: Complete TypeScript types and interfaces for the Todoist v1 REST API
- **API Client Interface**: Contract defining all Todoist operations for task management
- **OpenAPI Specification**: Complete API documentation in OpenAPI 3.0 format
- **Swagger UI**: Interactive API documentation and testing interface
- **Hono Server**: Lightweight API server framework setup

## Todoist API Integration

The Todoist API contract includes:

### Core Entities (Fully Typed)
- `User` - User account information
- `Project` - Projects with workspace support, colors, view styles
- `Task` - Full task model with due dates, priorities, labels, descriptions
- `Section` - Project sections with ordering
- `Comment` - Comments with file attachments and reactions
- `Label` - Personal and shared labels
- `Filter` - Saved filters with query support
- `Reminder` - Time and location-based reminders

### API Operations Contract
The `TodoistApiClient` interface defines 80+ methods covering:

- **Tasks**: CRUD, completion, moving, filtering, quick-add, bulk operations
- **Projects**: Full lifecycle management, archiving, collaborators
- **Comments**: With file attachment support
- **Labels & Filters**: Personal and shared management
- **Templates**: Export/import functionality
- **Activity Log**: Comprehensive event tracking
- **Productivity Stats**: Analytics and goal tracking
- **Uploads**: File attachment handling

### Advanced Features
- **Due Dates**: Full support for floating, fixed timezone, and recurring dates
- **Pagination**: Cursor-based pagination for all list endpoints
- **File Attachments**: Image, audio, and document support
- **Workspaces**: Team collaboration features
- **Error Handling**: Structured error responses
- **Type Safety**: 100% TypeScript coverage

## API Documentation

### Swagger UI (Interactive)
Start the interactive API documentation:

```bash
# Start Swagger UI server on port 8080
bun run docs

# Visit: http://localhost:8080/docs
```

The Swagger UI provides:
- **Interactive API Explorer**: Try out all endpoints directly from the browser
- **Authentication**: Bearer token support with local storage
- **Request/Response Examples**: Complete with sample data
- **Schema Documentation**: Full type definitions and constraints

### OpenAPI Specification
The API is fully documented in OpenAPI 3.0 format:

- **File**: `packages/backend/openapi.yaml`
- **Direct Access**: `http://localhost:8080/openapi.yaml` (when docs server is running)
- **Import**: Use in Postman, Insomnia, or generate client SDKs

### Key Endpoints Covered

#### Tasks
- `GET /api/tasks` - List tasks with filtering
- `POST /api/tasks` - Create new task
- `POST /api/tasks/{task_id}` - Update task
- `POST /api/tasks/{task_id}/close` - Complete task
- `POST /api/tasks/quick` - Quick-add with natural language

#### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{project_id}` - Get project details

#### Comments & Collaboration
- `GET /api/comments` - List comments
- `POST /api/comments` - Add comment
- `GET /api/activities` - Activity log

#### Advanced Features
- `GET /api/tasks/filter` - Filter tasks by query
- `GET /api/tasks/completed/by_completion_date` - Completed tasks analytics
- `GET /api/tasks/completed/stats` - Productivity statistics
- `POST /api/uploads` - File uploads
- `GET /api/templates/file` - Export project templates

## Usage

### Testing with Swagger UI

1. **Start the docs server**:
   ```bash
   bun run docs
   ```

2. **Open Swagger UI**:
   - Visit: `http://localhost:8080/docs`
   - Click "Authorize" button
   - Enter your Todoist API token: `Bearer YOUR_TOKEN_HERE`

3. **Test endpoints**:
   - Try `GET /api/tasks` to list your tasks
   - Use `POST /api/tasks` to create a new task
   - Explore all available endpoints interactively

### Using the TypeScript Client

```typescript
import { TodoistApiClient, CreateTaskRequest } from '@donegeon/backend/todoist';

// Use the client interface
const client: TodoistApiClient = getTodoistClient();

const taskRequest: CreateTaskRequest = {
  content: "Buy groceries",
  project_id: "123456",
  priority: 4,
  due_string: "tomorrow"
};

const task = await client.createTask(taskRequest);
```

## File Structure

```
packages/backend/
├── src/
│   ├── todoist/
│   │   ├── types.ts      # Complete Todoist API type definitions
│   │   ├── client.ts     # API client interface/contract
│   │   └── index.ts      # Main exports
│   └── types/
│       └── index.ts      # General backend types
├── docs/
│   └── index.ts          # Swagger UI server
├── openapi.yaml          # OpenAPI 3.0 specification
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# View interactive API docs
bun run docs

# Build for production
bun run build

# Run tests
bun run test

# Type checking
bun run type-check
```

## API Documentation Links

- **OpenAPI Spec**: `packages/backend/openapi.yaml`
- **Todoist API Reference**: https://developer.todoist.com/api/v1/
- **OpenAPI 3.0 Guide**: https://swagger.io/specification/

## Authentication

All API endpoints require authentication using Todoist API tokens:

```
Authorization: Bearer YOUR_TODOIST_API_TOKEN
```

Get your token from: https://app.todoist.com/app/settings/integrations