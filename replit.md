# School ERP System

## Overview

This is a comprehensive School Enterprise Resource Planning (ERP) system built as a full-stack web application. The system provides role-based access control for managing student information, fee payments, grades, and academic reports. It serves two primary user roles: Administrators (Principals) who have full CRUD access to all features, and Teachers who have limited read/write access focused on grade management.

The application is designed for educational institutions to streamline administrative tasks, track student data, manage financial transactions, and generate academic reports.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Wouter for lightweight client-side routing instead of React Router

**UI Component Library**
- Shadcn/ui components (New York style variant) built on Radix UI primitives
- Provides accessible, customizable components including dialogs, dropdowns, tables, forms, and cards
- All UI components follow a consistent design system with Tailwind CSS

**Styling System**
- Tailwind CSS for utility-first styling with custom theme configuration
- Material Design principles combined with Linear's modern aesthetic
- Inter font family for clean, readable typography
- Custom CSS variables for theming (supports light/dark modes)
- Design tokens for spacing, colors, borders, and shadows defined in index.css

**State Management**
- React Hooks (useState, useEffect) for local component state
- TanStack Query (React Query) for server state management and data fetching
- Props drilling pattern for sharing state between parent and child components
- No global state management library (Redux/Zustand) - state is managed at the App level

**Form Handling**
- React Hook Form with Zod resolver for form validation
- Custom modal components for student creation/editing
- Controlled inputs with real-time validation

**Data Visualization**
- Dashboard cards showing key metrics (total students, pending fees, grades entered, attendance)
- Data tables with search, filter, and CRUD operations
- Report generation with printable views

### Backend Architecture

**Server Framework**
- Express.js (ESM modules) as the HTTP server
- TypeScript for type safety across the backend
- Modular route registration pattern (currently routes are minimal)

**API Design**
- RESTful API architecture (routes prefixed with /api)
- JSON request/response format
- Express middleware for request logging, JSON parsing, and error handling

**Development Features**
- Custom request logging middleware that tracks duration and response for API calls
- Vite middleware integration for seamless dev experience
- Hot module reloading during development

**Storage Layer**
- Abstract storage interface (IStorage) for database operations
- In-memory storage implementation (MemStorage) for development/demo purposes
- Designed to be replaced with PostgreSQL using Drizzle ORM
- Storage methods include: getUser, getUserByUsername, createUser

### Data Storage Solutions

**Current Implementation**
- MemStorage class using JavaScript Maps for temporary in-memory data storage
- All data is stored in client-side state (students, fees, grades arrays)
- Data is lost on page refresh (no persistence)

**Database Schema (Drizzle ORM - Ready for PostgreSQL)**
- Drizzle ORM configured with PostgreSQL dialect
- Schema defined in shared/schema.ts using drizzle-orm/pg-core
- Users table with id (UUID), username (unique), and password fields
- Zod schemas for runtime validation using drizzle-zod
- Migration files configured to output to ./migrations directory

**Planned Database Integration**
- Neon Serverless PostgreSQL (@neondatabase/serverless package installed)
- Connection via DATABASE_URL environment variable
- Drizzle Kit for schema migrations and database management

**CSV Import/Export**
- PapaParse library for parsing CSV files
- Bulk student and grade data import functionality
- Data export capabilities for reports and backups

### Authentication and Authorization

**Current Authentication State**
- Mock authentication system (hardcoded credentials)
- Two user roles: 'admin' and 'teacher'
- Login page with email/password form
- Session state managed in App component

**Role-Based Access Control**
- Admin role: Full access to Dashboard, Students (CRUD), Fees, Reports, Grades, Data Tools
- Teacher role: Limited access to Dashboard and Grades (entry only)
- Navigation menu dynamically renders based on user role
- Read-only vs. full CRUD permissions enforced at component level

**Planned Authentication**
- Database-backed user authentication (users table ready)
- Password hashing (implementation pending)
- Session management using connect-pg-simple for PostgreSQL session store
- Secure cookie-based sessions

### External Dependencies

**Third-Party Libraries**

*UI & Styling*
- @radix-ui/* (v1.x) - Accessible component primitives for dialogs, dropdowns, menus, etc.
- tailwindcss (v3.x) - Utility-first CSS framework
- class-variance-authority - Type-safe variant styling
- lucide-react - Icon library
- embla-carousel-react - Carousel/slider components

*Data Management*
- @tanstack/react-query (v5.x) - Async state and server cache management
- react-hook-form - Form state management
- @hookform/resolvers - Form validation integration
- zod - Schema validation
- drizzle-zod - Drizzle ORM to Zod schema conversion

*Date & Time*
- date-fns (v3.x) - Date formatting and manipulation utilities

*Database & ORM*
- drizzle-orm (v0.39.x) - TypeScript ORM for SQL databases
- @neondatabase/serverless (v0.10.x) - Neon PostgreSQL driver
- connect-pg-simple - PostgreSQL session store for Express

*File Processing*
- papaparse (v5.4.x) - CSV parsing (loaded via CDN in index.html)

*Development Tools*
- vite (v5.x) - Frontend build tool and dev server
- @vitejs/plugin-react - React plugin for Vite
- tsx - TypeScript execution for Node.js
- esbuild - JavaScript bundler for production builds
- @replit/* plugins - Replit-specific development enhancements

**External Services**
- Google Fonts (Inter font family) - Loaded via CDN
- Currently no external APIs or cloud services integrated
- Application designed to be self-contained

**Build & Deployment**
- Development: `npm run dev` - Runs tsx server with Vite middleware
- Build: `npm run build` - Vite build for client, esbuild for server
- Production: `npm start` - Runs compiled server from dist/
- Database: `npm run db:push` - Pushes Drizzle schema to PostgreSQL