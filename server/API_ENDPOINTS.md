# Team Collaboration Workspace - API Documentation

## Authentication

All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

## Base URL
```
http://localhost:3001/api
```

---

## Screening Chats

### Create Screening Chat
**Endpoint:** `POST /api/screening-chats`

**Description:** Create a screening chat for an accepted application (founder only)

**Request Body:**
```json
{
  "applicationId": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "message": "Screening chat created successfully",
  "chat": {
    "id": "uuid",
    "applicationId": "uuid",
    "founderId": "uuid",
    "applicantId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Application not found
- `403` - Only founder can create screening chats
- `409` - Screening chat already exists

---

### Get Screening Chat
**Endpoint:** `GET /api/screening-chats/:id`

**Description:** Get screening chat details (founder or applicant only)

**Response:** `200 OK`
```json
{
  "chat": {
    "id": "uuid",
    "applicationId": "uuid",
    "founderId": "uuid",
    "applicantId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "founder": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "applicant": {
      "id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  }
}
```

**Errors:**
- `404` - Screening chat not found
- `403` - Access denied

---

### Send Screening Message
**Endpoint:** `POST /api/screening-chats/:id/messages`

**Description:** Send a message in screening chat

**Request Body:**
```json
{
  "content": "Hello! Let's discuss the project."
}
```

**Response:** `201 Created`
```json
{
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "screeningChatId": "uuid",
    "senderId": "uuid",
    "content": "Hello! Let's discuss the project.",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `403` - Access denied
- `400` - Content empty or exceeds 5000 characters

---

### Get Screening Messages
**Endpoint:** `GET /api/screening-chats/:id/messages`

**Description:** Get message history for screening chat

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "uuid",
      "screeningChatId": "uuid",
      "senderId": "uuid",
      "content": "Hello!",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "sender": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "url"
      }
    }
  ]
}
```

**Errors:**
- `403` - Access denied

---

## Team Formation

### Invite to Builder Space
**Endpoint:** `POST /api/teams/applications/:id/invite`

**Description:** Invite accepted applicant to become team member (founder only)

**Response:** `201 Created`
```json
{
  "message": "Applicant invited to Builder Space successfully",
  "teamMember": {
    "id": "uuid",
    "userId": "uuid",
    "postType": "startup",
    "postId": "uuid",
    "role": "member",
    "joinedAt": "2024-01-01T00:00:00.000Z"
  },
  "builderSpace": {
    "id": "uuid",
    "postType": "startup",
    "postId": "uuid",
    "name": "Team Workspace",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Application not found
- `403` - Only founder can invite
- `400` - Application not accepted or already a member

---

### Get Team Members
**Endpoint:** `GET /api/teams/:postType/:postId/members`

**Description:** Get all team members for a post

**Parameters:**
- `postType`: "startup" or "hackathon"
- `postId`: UUID of the post

**Response:** `200 OK`
```json
{
  "members": [
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "founder",
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "url"
      }
    }
  ]
}
```

**Errors:**
- `404` - Post not found
- `403` - Not authorized to view team
- `400` - Invalid post type

---

## Builder Spaces

### Get Builder Space
**Endpoint:** `GET /api/builder-spaces/:id`

**Description:** Get Builder Space details (team members only)

**Response:** `200 OK`
```json
{
  "space": {
    "id": "uuid",
    "postType": "startup",
    "postId": "uuid",
    "name": "Team Workspace",
    "description": "Collaborative workspace",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Builder Space not found or access denied

---

### Send Group Message
**Endpoint:** `POST /api/builder-spaces/:id/messages`

**Description:** Send message to team group chat

**Request Body:**
```json
{
  "content": "Welcome to the team!"
}
```

**Response:** `201 Created`
```json
{
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "spaceId": "uuid",
    "senderId": "uuid",
    "content": "Welcome to the team!",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `403` - Not a team member
- `400` - Content empty or exceeds 5000 characters

---

### Get Group Messages
**Endpoint:** `GET /api/builder-spaces/:id/messages`

**Description:** Get group message history

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "uuid",
      "spaceId": "uuid",
      "senderId": "uuid",
      "content": "Welcome!",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "sender": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "url"
      }
    }
  ]
}
```

**Errors:**
- `403` - Not a team member

---

### Add Shared Link
**Endpoint:** `POST /api/builder-spaces/:id/links`

**Description:** Add a shared link to Builder Space

**Request Body:**
```json
{
  "title": "GitHub Repository",
  "url": "https://github.com/team/project",
  "description": "Main project repo"
}
```

**Response:** `201 Created`
```json
{
  "message": "Link added successfully",
  "link": {
    "id": "uuid",
    "spaceId": "uuid",
    "creatorId": "uuid",
    "title": "GitHub Repository",
    "url": "https://github.com/team/project",
    "description": "Main project repo",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `403` - Not a team member
- `400` - Invalid URL format

---

### Get Shared Links
**Endpoint:** `GET /api/builder-spaces/:id/links`

**Description:** Get all shared links in Builder Space

**Response:** `200 OK`
```json
{
  "links": [
    {
      "id": "uuid",
      "spaceId": "uuid",
      "creatorId": "uuid",
      "title": "GitHub Repository",
      "url": "https://github.com/team/project",
      "description": "Main project repo",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "creator": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "url"
      }
    }
  ]
}
```

**Errors:**
- `403` - Not a team member

---

### Remove Shared Link
**Endpoint:** `DELETE /api/builder-spaces/:id/links/:linkId`

**Description:** Remove a shared link (creator only)

**Response:** `200 OK`
```json
{
  "message": "Link removed successfully"
}
```

**Errors:**
- `404` - Link not found
- `403` - Not authorized (only creator can remove)

---

### Create Task
**Endpoint:** `POST /api/builder-spaces/:id/tasks`

**Description:** Create a task in Builder Space

**Request Body:**
```json
{
  "title": "Setup database schema",
  "description": "Create initial tables"
}
```

**Response:** `201 Created`
```json
{
  "message": "Task created successfully",
  "task": {
    "id": "uuid",
    "spaceId": "uuid",
    "creatorId": "uuid",
    "title": "Setup database schema",
    "description": "Create initial tables",
    "completed": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `403` - Not a team member
- `400` - Invalid input

---

### Get Tasks
**Endpoint:** `GET /api/builder-spaces/:id/tasks`

**Description:** Get all tasks in Builder Space

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "id": "uuid",
      "spaceId": "uuid",
      "creatorId": "uuid",
      "title": "Setup database",
      "description": "Create tables",
      "completed": false,
      "completedBy": null,
      "completedAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "creator": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "url"
      }
    }
  ]
}
```

**Errors:**
- `403` - Not a team member

---

### Update Task Status
**Endpoint:** `PUT /api/builder-spaces/:id/tasks/:taskId`

**Description:** Update task completion status (any team member)

**Request Body:**
```json
{
  "completed": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Task updated successfully",
  "task": {
    "id": "uuid",
    "spaceId": "uuid",
    "creatorId": "uuid",
    "title": "Setup database",
    "completed": true,
    "completedBy": "uuid",
    "completedAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Task not found
- `403` - Not a team member

---

### Delete Task
**Endpoint:** `DELETE /api/builder-spaces/:id/tasks/:taskId`

**Description:** Delete a task (creator only)

**Response:** `200 OK`
```json
{
  "message": "Task deleted successfully"
}
```

**Errors:**
- `404` - Task not found
- `403` - Not authorized (only creator can delete)

---

## WebSocket Connection

### Connect to WebSocket
**URL:** `ws://localhost:3001?userId=YOUR_USER_ID`

**Description:** Connect to receive real-time notifications

**Message Format:**
```json
{
  "type": "screening_message" | "group_message" | "link_added" | "link_removed" | "task_created" | "task_updated" | "task_deleted" | "builder_space_created" | "screening_chat_created",
  "payload": {
    // Event-specific data
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Example Messages:**

New Group Message:
```json
{
  "type": "group_message",
  "payload": {
    "id": "uuid",
    "spaceId": "uuid",
    "senderId": "uuid",
    "content": "Hello team!",
    "sender": {
      "name": "John Doe",
      "avatar": "url"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Task Created:
```json
{
  "type": "task_created",
  "payload": {
    "id": "uuid",
    "spaceId": "uuid",
    "title": "New task",
    "creator": {
      "name": "John Doe"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Response Format

All errors follow this format:
```json
{
  "error": "Error message description"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `403` - Forbidden (authorization error)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error
