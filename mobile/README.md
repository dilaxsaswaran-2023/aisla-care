# AISLA Elderly Monitoring – Mobile App

React Native mobile application for the **AISLA Elderly Monitoring Platform**.

The app enables elderly users to communicate with caregivers, trigger emergency alerts, share GPS location, view reminders, and interact with a basic AI assistant.

---

# Tech Stack

Framework: **React Native 0.74.x (LTS)**  
Language: **TypeScript**  
State Management: **Redux Toolkit**  
Navigation: **React Navigation**  
Networking: **Axios**  
Realtime Communication: **Socket.IO / WebSocket**  
Maps: **react-native-maps**  
Location Services: **react-native-geolocation-service**  
Audio Recording: **react-native-audio-recorder-player**  
Local Storage: **AsyncStorage**

---

# Features

- Caregiver communication (text & audio chat)
- Panic / emergency alert button
- GPS location sharing
- Reminder notifications
- AI chatbot assistance
- Real-time dashboard integration

---

# System Architecture

```
React Native Mobile App
        |
        | REST API
        v
Backend Server
        |
        | WebSocket Gateway
        v
Realtime Event System

Backend Services
- Authentication
- Chat Service
- Alert Service
- GPS Tracking
- Reminder Service
- Chatbot Service
```

---

# Project Structure

```
src/
api/                # REST API clients
redux/              # Redux store configuration
components/         # Shared UI components
screens/            # Screen modules
navigation/         # Navigation configuration
services/           # Socket, location, audio services
utils/              # Utility functions
constants/          # App constants
types/              # TypeScript interfaces
```

---

# Core Modules

## Authentication
Handles user login, session management, and token storage.

## Chat
Provides real-time communication between elderly users and caregivers.

Features:
- Text messaging
- Audio messaging
- Message history
- Delivery/read status

## Panic Alert
Emergency help system.

Flow:
1. User presses help button
2. Mobile sends alert to backend
3. Backend broadcasts alert to dashboard
4. Caregiver acknowledges alert
5. Status update sent back to mobile

Alert states:
- TRIGGERED
- ACKNOWLEDGED
- RESOLVED

## GPS Location
Allows users to share location with caregivers.

Modes:
- Manual location share
- Background updates
- Panic-trigger location share

## Reminder Module
Displays scheduled reminders such as:

- Medication
- Exercise
- Hydration
- Doctor appointments

Reminder states:
- Pending
- Completed
- Skipped

## Chatbot
AI-assisted conversation module.

Capabilities:
- Emotional check-in
- Guidance and support
- Health reminder conversations

Architecture:

```
Mobile App → Backend → AI Service → Response
```

---

# Development Setup

## Requirements

- Node.js **18 LTS**
- React Native CLI
- Android Studio
- Xcode (for iOS development)
- CocoaPods
- Java JDK 17

---

# Installation

Clone the repository:

```bash
git clone https://github.com/your-org/aisla-mobile.git
cd aisla-mobile
```

Install dependencies:

```bash
npm install
```

Install iOS pods:

```bash
cd ios
pod install
cd ..
```

---

# Running the App

### Run Android

```bash
npx react-native run-android
```

### Run iOS

```bash
npx react-native run-ios
```

---

# Environment Variables

Create a `.env` file in the root directory.

```
API_BASE_URL=https://api.example.com
SOCKET_URL=https://realtime.example.com
MAPS_API_KEY=your_maps_key
APP_ENV=development
```

---

# Realtime Events

Socket events used by the application:

```
chat_message
alert_trigger
alert_status_update
gps_update
user_presence
```

---

# Security Considerations

- HTTPS communication
- JWT authentication
- Secure token storage
- Backend-controlled AI access
- Permission handling for location and microphone

---

# MVP Development Phases

## Phase 1
- Project setup
- Authentication
- Navigation structure

## Phase 2
- Chat system
- Realtime connection
- Audio messaging

## Phase 3
- GPS sharing
- Panic alert system

## Phase 4
- Reminder module
- Chatbot integration

## Phase 5
- Testing
- Bug fixes
- Deployment

---

# Future Enhancements

- IoT sensor integration
- Fall detection
- Advanced AI assistance
- Health monitoring devices
- Predictive alerts

---

# License

Internal project – AISLA Monitoring Platform
