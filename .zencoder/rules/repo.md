---
description: Repository Information Overview
alwaysApply: true
---

# DoSpill Information

## Summary
DoSpill is a Progressive Web App (PWA) messenger similar to iMessage with a visually stunning interface. It provides real-time messaging capabilities with features like group chats, media sharing, and user profiles. The application includes both a main client interface and an admin panel for user management.

## Structure
- **api/**: Serverless API functions for Firebase configuration and authentication
- **admin/**: Admin panel interface for user management and content moderation
- **js/**: Core application JavaScript files including the main app logic
- **styles/**: CSS stylesheets for the application
- **.zencoder/**: Configuration directory for the Zencoder tool
- **service-worker.js**: Service worker for PWA offline functionality

## Language & Runtime
**Language**: JavaScript (ES6+)
**Runtime**: Browser-based application with service worker support
**Framework**: Progressive Web App (PWA) architecture
**Backend**: Firebase (Authentication, Firestore, Storage)

## Dependencies
**Main Dependencies**:
- Firebase SDK v9.17.1 (auth, firestore)
- Google Fonts (Lexend)

**External Services**:
- Firebase Authentication
- Firebase Firestore (database)
- Firebase Storage (for media)
- Backblaze B2 (for file uploads)

## Build & Installation
The application doesn't require a build step as it uses vanilla JavaScript. It's designed to be deployed to a hosting service like Vercel that supports serverless functions.

```bash
# No build commands required - deploy directly to hosting
```

## PWA Configuration
**Manifest**: manifest.json defines the app name, icons, and display properties
**Service Worker**: service-worker.js implements caching strategy for offline support
**Cache Strategy**: Cache-first for static assets, network-first for dynamic content

## Main Files
**Entry Point**: index.html
**Core Logic**: js/app.js
**API Endpoints**:
- api/get-firebase-config.js: Securely provides Firebase configuration
- api/admin-login.js: Handles admin authentication
- api/b2-upload-url.js: Generates upload URLs for Backblaze B2

## Admin Interface
**Entry Point**: admin/index.html
**Admin Logic**: admin/admin.js
**Features**: User management, content moderation, statistics dashboard

## Security
**Authentication**: Firebase Authentication with multiple sign-in methods (Google, Email, Anonymous)
**API Security**: Environment variables for Firebase configuration
**Admin Access**: Separate authentication for admin panel