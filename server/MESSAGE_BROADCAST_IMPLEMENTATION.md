# MessageBroadcastService Implementation

## Overview

The MessageBroadcastService provides real-time message delivery via WebSocket for the Team Collaboration Workspace. It enables instant communication between team members in Builder Spaces and between founders and applicants in screening chats.

## Features Implemented

### 1. WebSocket Server Integration
- **WebSocket Server**: Integrated with Express HTTP server on `/ws` endpoint
- **Connection Management**: Tracks active WebSocket connections per user
- **Heartbeat Monitoring**: Automatically detects and closes stale connections (60-second timeout)
- **Connection Authentication**: Requires userId query parameter for connection

### 2. Online User Tracking
- **Connection Map**: Maintains real-time map of online users and their WebSocket connections
- **User Status Broadcasting**: Notifies team members when users come online/offline
- **Connection State**: Tracks last heartbeat timestamp for each connection

### 3. Message Broadcasting
- **Group Messages**: Broadcasts messages to all team members in a Builder Space
- **Screening Messages**: Broadcasts messages to both participants in a screening chat
- **Sender Exclusion**: Optionally excludes message sender from broadcast (prevents echo)
- **Batch Broadcasting**: Efficiently broadcasts to multiple users simultaneously

### 4. Message Queuing for Offline Users
- **Automatic Queuing**: Messages for offline users are automatically queued
- **Queue Size Limit**: Maximum 100 messages per user to prevent memory issues
- **Queue Age Limit**: Messages older than 24 hours are automatically expired
- **Delivery on Connect**: Queued messages are delivered when user comes online

### 5. Message Types Supported
- `GROUP_MESSAGE`: Team chat messages in Builder Spaces
- `SCREENING_MESSAGE`: 1-to-1 messages in screening chats
- `LINK_ADDED`: Shared link notifications
- `LINK_REMOVED`: Link removal notifications
- `TASK_CREATED`: New task notifications
- `TASK_UPDATED`: Task status change notifications
- `TASK_DELETED`: Task deletion notifications
- `TEAM_MEMBER_JOINED`: New team member notifications
- `BUILDER_SPACE_CREATED`: New Builder Space notifications
- `SCREENING_CHAT_CREATED`: New screening chat notifications
- `USER_ONLINE`: User online status
- `USER_OFFLINE`: User offline status
- `CONNECT`: Connection confirmation
- `DISCONNECT`: Disconnection notification
- `HEARTBEAT`: Connection health check

## Architecture

### Service Structure

```typescript
MessageBroadcastService
├── WebSocket Server (ws)
├── Connection Management
│   ├── connections: Map<userId, ConnectionInfo>
│   ├── heartbeat monitoring
│   └── connection lifecycle
├── Message Broadcasting
│   ├── sendToUser()
│   ├── broadcastToUsers()
│   ├── broadcastGroupMessage()
│   └── broadcastScreeningMessage()
├── Message Queuing
│   ├── messageQueue: Map<userId, QueuedMessage[]>
│   ├── queueMessage()
│   └── deliverQueuedMessages()
└── Team Member Lookup
    ├── getTeamMembersBySpace()
    └── getUserSpaces()
```

### Integration with Existing Services

#### GroupChatService Integration
```typescript
// After sending a group message, broadcast to team members
await messageBroadcastService.broadcastGroupMessage(
  spaceId,
  {
    type: MessageType.GROUP_MESSAGE,
    payload: message,
    timestamp: now,
    senderId,
  },
  senderId // Exclude sender
);
```

#### ScreeningMessageService Integration
```typescript
// After sending a screening message, broadcast to participants
messageBroadcastService.broadcastScreeningMessage(
  applicationId,
  founderId,
  applicantId,
  {
    type: MessageType.SCREENING_MESSAGE,
    payload: message,
    timestamp: now,
    senderId,
  },
  senderId // Exclude sender
);
```

## WebSocket Connection Flow

### Client Connection
1. Client connects to `ws://server/ws?userId=<userId>`
2. Server validates userId and creates connection
3. Server sends connection confirmation
4. Server delivers any queued messages
5. Server broadcasts user online status to team members

### Message Flow
1. User sends message via REST API
2. Service stores message in database
3. Service calls MessageBroadcastService to broadcast
4. Service identifies recipients (team members or chat participants)
5. For online users: message sent immediately via WebSocket
6. For offline users: message queued for later delivery

### Heartbeat Flow
1. Client sends heartbeat message every 30 seconds
2. Server updates lastHeartbeat timestamp
3. Server responds with heartbeat acknowledgment
4. Server monitors connections every 30 seconds
5. Connections with no heartbeat for 60+ seconds are closed

### Disconnection Flow
1. Client closes WebSocket connection
2. Server removes connection from map
3. Server broadcasts user offline status to team members
4. Messages for user are queued until reconnection

## Configuration

### Constants
- `HEARTBEAT_INTERVAL`: 30 seconds (monitoring frequency)
- `MESSAGE_QUEUE_MAX_SIZE`: 100 messages per user
- `MESSAGE_QUEUE_MAX_AGE`: 24 hours
- `STALE_CONNECTION_THRESHOLD`: 60 seconds

### WebSocket Path
- Path: `/ws`
- Query Parameter: `userId` (required)

## Testing

### Test Coverage
- **35 unit tests** covering all functionality
- **100% pass rate** on all tests

### Test Categories
1. **WebSocket Connection Management** (4 tests)
   - Server initialization
   - Online user tracking
   - Connection state queries

2. **Message Broadcasting** (6 tests)
   - Offline message queuing
   - Multi-user broadcasting
   - Screening message broadcasting
   - Sender exclusion

3. **Message Queuing** (4 tests)
   - Queue management
   - Queue size limits
   - Multiple user queues

4. **Message Types** (7 tests)
   - All message type support
   - Type-specific payloads

5. **Team Member Lookup** (2 tests)
   - Space member broadcasting
   - Non-existent space handling

6. **Service Lifecycle** (3 tests)
   - Graceful shutdown
   - Connection cleanup
   - Multiple shutdown handling

7. **Edge Cases** (4 tests)
   - Empty user lists
   - Duplicate user IDs
   - Invalid payloads

8. **Real-time Notifications** (5 tests)
   - Link notifications
   - Task notifications
   - Team formation notifications

## Usage Examples

### Initialize WebSocket Server
```typescript
import { messageBroadcastService } from './services/MessageBroadcastService.js';
import { createServer } from 'http';

const httpServer = createServer(app);
messageBroadcastService.initialize(httpServer);

httpServer.listen(PORT);
```

### Broadcast Group Message
```typescript
await messageBroadcastService.broadcastGroupMessage(
  spaceId,
  {
    type: MessageType.GROUP_MESSAGE,
    payload: {
      id: messageId,
      content: 'Hello team!',
      senderId: userId,
      senderName: 'John Doe',
      createdAt: new Date(),
    },
    timestamp: new Date(),
    senderId: userId,
  },
  userId // Exclude sender
);
```

### Broadcast Screening Message
```typescript
messageBroadcastService.broadcastScreeningMessage(
  applicationId,
  founderId,
  applicantId,
  {
    type: MessageType.SCREENING_MESSAGE,
    payload: {
      id: messageId,
      content: 'Thanks for applying!',
      senderId: founderId,
      senderName: 'Founder Name',
      createdAt: new Date(),
    },
    timestamp: new Date(),
    senderId: founderId,
  },
  founderId // Exclude sender
);
```

### Check User Online Status
```typescript
const isOnline = messageBroadcastService.isUserOnline(userId);
const onlineUsers = messageBroadcastService.getOnlineUsers();
const onlineCount = messageBroadcastService.getOnlineUserCount();
```

### Check Queued Messages
```typescript
const queuedCount = messageBroadcastService.getQueuedMessageCount(userId);
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 5.1**: Real-time message delivery to team members
- **Requirement 5.5**: Real-time notifications to online team members
- **Requirement 8.1**: Immediate message delivery for collaboration events

## Future Enhancements

Potential improvements for future iterations:

1. **Reconnection Logic**: Automatic client reconnection with exponential backoff
2. **Message Acknowledgments**: Confirm message delivery to clients
3. **Presence Indicators**: Show typing indicators and read receipts
4. **Message Priority**: Priority queue for critical notifications
5. **Compression**: WebSocket message compression for bandwidth optimization
6. **Clustering**: Support for multiple server instances with Redis pub/sub
7. **Analytics**: Track message delivery metrics and connection statistics

## Dependencies

- `ws`: WebSocket library for Node.js
- `drizzle-orm`: Database ORM for team member lookups
- `better-sqlite3`: SQLite database driver

## Files Created

1. `app/server/src/services/MessageBroadcastService.ts` - Main service implementation
2. `app/server/src/services/MessageBroadcastService.test.ts` - Comprehensive unit tests
3. `app/server/MESSAGE_BROADCAST_IMPLEMENTATION.md` - This documentation

## Files Modified

1. `app/server/src/services/GroupChatService.ts` - Added broadcast integration
2. `app/server/src/services/ScreeningMessageService.ts` - Added broadcast integration

## Next Steps

To complete the real-time collaboration system:

1. **Server Integration**: Initialize MessageBroadcastService in `server.ts`
2. **Client Implementation**: Create WebSocket client in frontend
3. **UI Updates**: Add real-time message rendering in chat components
4. **Notification System**: Implement browser notifications for offline messages
5. **Testing**: End-to-end testing with real WebSocket connections
