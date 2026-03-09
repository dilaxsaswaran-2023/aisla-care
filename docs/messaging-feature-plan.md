# MVP 2-Way Messaging Feature Implementation Plan

This plan outlines the implementation of a WhatsApp-like real-time messaging system between patients and caregivers with text and audio capabilities.

## Current State Analysis

**Existing Infrastructure:**
- Backend: FastAPI + PostgreSQL with python-socketio already configured
- Frontend: React + TypeScript with socket.io-client available
- Basic Message model exists (sender_id, recipient_id, content, message_type)
- Basic ChatInterface component with polling (not real-time)
- User roles: patient, caregiver, family, admin, super_admin
- Socket.io server setup with basic connection handling
- UUID-based primary keys for all entities

**Missing Features for MVP:**
- Real-time Socket.io integration in frontend
- Audio message recording and playback
- Message delivery/read receipts
- Online status indicators
- Message history pagination
- File upload handling for audio
- Proper error handling and retry mechanisms

## Implementation Phases

### Phase 1: Real-time Text Messaging Foundation

**Backend Enhancements:**
1. Enhance Socket.io events for real-time messaging
2. Add message status tracking (sent, delivered, read)
3. Implement online presence management
4. Add message validation and error handling
5. Create conversation list endpoint

**Frontend Enhancements:**
1. Replace polling with Socket.io real-time connection
2. Add online status indicators
3. Implement message status indicators
4. Add conversation list component
5. Improve error handling and retry logic

### Phase 2: Audio Messaging

**Backend Enhancements:**
1. Add file upload handling (multer or similar)
2. Audio file storage and compression
3. Audio message type validation
4. Generate audio metadata (duration, size)

**Frontend Enhancements:**
1. Audio recording functionality (Web Audio API)
2. Audio player component
3. Audio message UI with waveform visualization
4. Recording controls and duration display
5. Audio file compression before upload

### Phase 3: Enhanced User Experience

**Features:**
1. Message search functionality
2. Message deletion and editing
3. Typing indicators
4. Push notifications for new messages
5. Message threading or grouping
6. Emoji support

## Technical Requirements

### Backend Dependencies Needed:
- `aiofiles` for async file uploads
- `python-multipart` (already included)
- `ffmpeg-python` for audio processing
- `redis` for socketio scaling (optional)

### Frontend Dependencies Needed:
- `react-audio-player` or custom audio component
- `waveform visualization` library
- `recorder.js` or similar for audio recording

### Database Schema Updates:
```python
# Enhanced Message model (SQLAlchemy)
class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    message_type = Column(Enum("text", "audio", "image", name="message_type"), nullable=False, default="text")
    file_url = Column(String, nullable=True)  # For audio/image messages
    file_metadata = Column(JSON, nullable=True)  # {"duration": 30, "size": 1024, "format": "mp3"}
    status = Column(Enum("sent", "delivered", "read", name="message_status"), nullable=False, default="sent")
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Conversation model (optional)
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participants = Column(ARRAY(UUID(as_uuid=True)), nullable=False)
    last_message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    last_activity = Column(DateTime, default=datetime.utcnow)
    unread_counts = Column(JSON, nullable=True)  # {"user_id": count}
```

### Socket.io Events:
```python
# Client -> Server
'join_room' (user_id)
'send_message' (message_data)
'typing_start' (recipient_id)
'typing_stop' (recipient_id)
'mark_read' (message_ids)
'online_status' (status)

# Server -> Client
'new_message' (message)
'message_status' (message_id, status)
'typing_indicator' (user_id, is_typing)
'user_online' (user_id)
'user_offline' (user_id)
'conversation_list' (conversations)
```

## API Endpoints

### Existing (to enhance):
- `GET /api/messages/{recipient_id}` - Get conversation history
- `POST /api/messages` - Send message

### New Endpoints:
- `POST /api/messages/upload-audio` - Upload audio file
- `GET /api/conversations` - Get user's conversation list
- `PUT /api/messages/{id}/read` - Mark messages as read
- `DELETE /api/messages/{id}` - Delete message
- `GET /api/messages/search` - Search messages

## FastAPI Implementation Notes

### File Upload Example:
```python
@app.post("/api/messages/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    recipient_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate file type and size
    if not file.content_type.startswith('audio/'):
        raise HTTPException(400, "File must be audio")
    
    # Save file with aiofiles
    file_path = f"uploads/audio/{uuid.uuid4()}.{file.filename.split('.')[-1]}"
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Process audio with ffmpeg if needed
    # Create message record
    # Return message data
```

### Socket.io Integration:
```python
@sio.event
async def send_message(sid, data):
    # Validate and save message to database
    message = Message(**data)
    db.add(message)
    db.commit()
    
    # Emit to recipient
    await sio.emit('new_message', message.to_dict(), room=data['recipient_id'])
    
    # Emit delivery confirmation
    await sio.emit('message_status', {
        'message_id': str(message.id),
        'status': 'delivered'
    }, room=sid)
```

## Security & Privacy Considerations

1. **Authorization**: Verify patients can only message their assigned caregivers
2. **File Validation**: Strict validation of audio file types and sizes
3. **Data Encryption**: Encrypt sensitive message content
4. **Rate Limiting**: Prevent spam and abuse
5. **Audit Logging**: Log all message activities for compliance

## Testing Strategy

1. **Unit Tests**: Message CRUD operations, Socket.io events
2. **Integration Tests**: End-to-end messaging flow
3. **Performance Tests**: Concurrent users, large message history
4. **Security Tests**: Authorization bypass, file upload vulnerabilities

## Deployment Considerations

1. **File Storage**: Configure CDN or cloud storage (AWS S3, Azure Blob) for audio files
2. **Socket.io Scaling**: Consider Redis adapter for multiple server instances
3. **Database Indexing**: Optimize PostgreSQL queries for message retrieval
4. **Monitoring**: Track message delivery times and error rates
5. **Async Processing**: Use Celery or similar for audio processing tasks

## Success Metrics

1. Messages delivered within 500ms
2. Audio messages upload/play within 2 seconds
3. 99.9% uptime for messaging service
4. Support for 1000+ concurrent users
5. Mobile-responsive design

## Migration Strategy

### Database Migration (Alembic):
The migration files are located in `backend-py/alembic/versions/` and are tracked with timestamps.

**Current Migration**: `2026_03_09_1545-1a2b3c4d_add_messaging_features.py`

```python
# Add new columns to messages table
def upgrade():
    op.add_column('messages', sa.Column('file_url', sa.String(), nullable=True))
    op.add_column('messages', sa.Column('file_metadata', sa.JSON(), nullable=True))
    op.add_column('messages', sa.Column('status', sa.Enum('sent', 'delivered', 'read'), nullable=False, server_default='sent'))
    op.add_column('messages', sa.Column('read_at', sa.DateTime(), nullable=True))
    
    # Create conversations table
    op.create_table('conversations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('participants', ARRAY(UUID(as_uuid=True)), nullable=False),
        sa.Column('last_message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('last_activity', sa.DateTime(), default=datetime.utcnow),
        sa.Column('unread_counts', sa.JSON(), nullable=True)
    )
```

### Migration Commands:
```bash
# Apply migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Description"

# Rollback
alembic downgrade -1
```

This plan provides a comprehensive roadmap for implementing a robust, real-time messaging system that meets healthcare communication standards while maintaining security and privacy using FastAPI, PostgreSQL, and modern Python technologies.
