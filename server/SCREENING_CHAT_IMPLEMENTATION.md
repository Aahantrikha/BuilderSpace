# Screening Chat Service Implementation

## Overview
This document describes the implementation of task 2.1: "Create ScreeningChatService for chat creation and management" from the team collaboration workspace spec.

## Components Implemented

### 1. ScreeningChatService (`src/services/ScreeningChatService.ts`)
A comprehensive service class that manages screening chat operations with the following features:

#### Key Methods:
- **`createScreeningChat(applicationId: string)`**: Creates a screening chat when an application is accepted
  - Validates application exists and is accepted
  - Retrieves founder/creator information based on post type (startup/hackathon)
  - Returns screening chat details with participants

- **`getScreeningChat(applicationId: string, userId: string)`**: Retrieves screening chat with authorization
  - Validates user is either founder or applicant
  - Throws access denied error for unauthorized users
  - Returns complete screening chat details

- **`getUserScreeningChats(userId: string)`**: Gets all screening chats for a user
  - Returns chats where user is applicant
  - Returns chats where user is founder
  - Handles both startup and hackathon applications
  - Only returns accepted applications

- **`validateScreeningChatAccess(applicationId: string, userId: string)`**: Validates user access
  - Returns authorization status and participants
  - Used by middleware for route protection

#### Design Features:
- **Dependency Injection**: Accepts optional database instance for testing
- **Type Safety**: Full TypeScript interfaces for all data structures
- **Error Handling**: Clear, descriptive error messages
- **Authorization**: Built-in access control for all operations

### 2. Screening Chat Authorization Middleware (`src/middleware/screeningChatAuth.ts`)
Express middleware that validates screening chat access:

#### Features:
- Validates authentication (requires authenticated user)
- Extracts application ID from route parameters
- Validates user authorization using ScreeningChatService
- Attaches participant information to request for route handlers
- Returns 403 Forbidden for unauthorized access

#### Usage:
```typescript
router.get('/:id', authenticateToken, validateScreeningChatAccess, handler);
```

### 3. Screening Chat API Routes (`src/routes/screeningChats.ts`)
RESTful API endpoints for screening chat operations:

#### Endpoints:
- **`GET /api/screening-chats`**: Get all screening chats for authenticated user
- **`GET /api/screening-chats/:id`**: Get specific screening chat (with authorization)

#### Features:
- Full authentication and authorization
- Consistent error handling
- JSON response format
- Proper HTTP status codes

### 4. Application Status Integration (`src/routes/applications.ts`)
Updated the application status endpoint to automatically create screening chats:

#### Changes:
- When application is accepted, automatically creates screening chat
- Returns screening chat details in response
- Graceful error handling (doesn't fail if chat creation fails)

### 5. Server Integration (`src/server.ts`)
Registered screening chat routes in the main server:
```typescript
app.use('/api/screening-chats', screeningChatRoutes);
```

## Testing

### Test Infrastructure
- **Framework**: Vitest with in-memory SQLite database
- **Setup**: Automated test database creation and cleanup
- **Coverage**: 22 comprehensive unit tests

### Test Coverage:
1. **createScreeningChat** (6 tests)
   - ✓ Creates chat for accepted startup application
   - ✓ Creates chat for accepted hackathon application
   - ✓ Throws error if application not found
   - ✓ Throws error if application not accepted
   - ✓ Throws error if startup not found
   - ✓ Throws error if hackathon not found

2. **getScreeningChat** (4 tests)
   - ✓ Allows founder to access screening chat
   - ✓ Allows applicant to access screening chat
   - ✓ Denies access to unauthorized users
   - ✓ Throws error if screening chat not found

3. **getUserScreeningChats** (6 tests)
   - ✓ Returns screening chats where user is applicant
   - ✓ Returns screening chats where user is founder
   - ✓ Returns multiple screening chats for user
   - ✓ Returns empty array if user has no screening chats
   - ✓ Only returns accepted applications
   - ✓ Handles both startup and hackathon applications

4. **validateScreeningChatAccess** (4 tests)
   - ✓ Returns authorized true for founder
   - ✓ Returns authorized true for applicant
   - ✓ Returns authorized false for unauthorized user
   - ✓ Returns authorized false for non-existent chat

5. **Edge Cases** (2 tests)
   - ✓ Handles empty post name gracefully
   - ✓ Handles concurrent access to same screening chat

### Test Results:
```
✓ 22 tests passed
✓ 0 tests failed
✓ Duration: ~66ms
```

## Requirements Validation

This implementation satisfies the following requirements from the spec:

### Requirement 1.1: Screening Chat Creation
✓ System creates screening chat when founder accepts application
✓ Screening chat created between founder and applicant

### Requirement 1.3: Access Control
✓ Only founder and accepted applicant can access screening chat
✓ Separate screening chats maintained for each founder-applicant pair

### Requirement 1.5: Separate Screening Chats
✓ System maintains separate screening chats per team
✓ Each application has its own screening chat context

## API Usage Examples

### Get All Screening Chats
```bash
GET /api/screening-chats
Authorization: Bearer <token>

Response:
{
  "screeningChats": [
    {
      "id": "app-123",
      "applicationId": "app-123",
      "founderId": "user-456",
      "applicantId": "user-789",
      "postType": "startup",
      "postId": "startup-101",
      "postName": "My Startup",
      "status": "accepted",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Specific Screening Chat
```bash
GET /api/screening-chats/app-123
Authorization: Bearer <token>

Response:
{
  "screeningChat": {
    "id": "app-123",
    "applicationId": "app-123",
    "founderId": "user-456",
    "applicantId": "user-789",
    "postType": "startup",
    "postId": "startup-101",
    "postName": "My Startup",
    "status": "accepted",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Accept Application (Auto-creates Screening Chat)
```bash
PUT /api/applications/app-123/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "accepted"
}

Response:
{
  "message": "Application accepted successfully",
  "application": { ... },
  "screeningChat": {
    "id": "app-123",
    "applicationId": "app-123",
    "founderId": "user-456",
    "applicantId": "user-789",
    "postType": "startup",
    "postId": "startup-101",
    "postName": "My Startup",
    "status": "accepted",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Authorization Checks**: Only participants can access screening chats
3. **Input Validation**: Application IDs validated before processing
4. **Error Messages**: Descriptive but secure error messages
5. **Database Integrity**: Foreign key constraints enforced

## Next Steps

The following tasks build upon this implementation:
- Task 2.2: Write property test for screening chat creation and access control
- Task 2.3: Create ScreeningMessageService for message operations
- Task 2.4: Write property test for message persistence and authorization
- Task 2.5: Write property test for message chronological ordering

## Files Created/Modified

### Created:
- `app/server/src/services/ScreeningChatService.ts`
- `app/server/src/middleware/screeningChatAuth.ts`
- `app/server/src/routes/screeningChats.ts`
- `app/server/src/services/ScreeningChatService.test.ts`
- `app/server/src/tests/setup.ts`
- `app/server/vitest.config.ts`

### Modified:
- `app/server/src/routes/applications.ts` (added screening chat creation on accept)
- `app/server/src/server.ts` (registered screening chat routes)
- `app/server/package.json` (added test scripts and vitest dependency)

## Build and Test Commands

```bash
# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Conclusion

Task 2.1 has been successfully completed with:
- ✓ Full implementation of ScreeningChatService
- ✓ Authorization middleware for access control
- ✓ RESTful API endpoints
- ✓ Comprehensive unit tests (22 tests, all passing)
- ✓ Integration with existing application workflow
- ✓ Type-safe, well-documented code
- ✓ Requirements 1.1, 1.3, and 1.5 satisfied
