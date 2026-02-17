# Frontend & Live Preview

## Overview

The EduGenius frontend is a React application that provides role-based views of the platform. It includes a live preview feature that allows switching between different user perspectives (CEO, Admin, Teacher, Student) without authentication.

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **Zustand** for state management
- **Framer Motion** for animations
- **Lucide React** for icons

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:5173`

## Role-Based Views

### Role Switcher

The header includes a role switcher dropdown that allows instant switching between:

| Role | Icon | Primary View | Key Features |
|------|------|--------------|--------------|
| CEO | 👔 | Analytics Dashboard | Business metrics, Oracle insights, revenue |
| Admin | ⚙️ | System Overview | Content management, agents, deployments |
| Teacher | 👩‍🏫 | Students | Class roster, progress tracking, nudges |
| Student | 🎓 | Learn | Topics, AI tutor, practice, notebook |

### Route: `/preview`

Standalone page showing all roles with descriptions and feature lists. Use this to understand what each role can access.

## Pages

### Dashboard (`/`)

Dynamic dashboard based on current role:
- **CEO**: Business KPIs, revenue trends, agent status
- **Admin**: System health, recent activity, quick actions
- **Teacher**: Class overview, at-risk students, upcoming tasks
- **Student**: Today's goals, streak, recommended topics

### Learn (`/learn`)

Student learning interface:
- Subject cards with progress
- AI-recommended topics
- Topic browser with difficulty indicators
- Quick actions (Chat, Notebook, Progress)

### Smart Notebook (`/notebook`)

AI-powered equation solving:
- Text/equation/drawing input modes
- Real-time AI explanations
- Step-by-step solutions
- Related topics suggestions
- Handwriting recognition (drawing mode)

### Progress (`/progress`)

Student progress tracking:
- Overall progress with circular indicator
- Subject-wise breakdown
- Weekly activity heatmap
- Test score history
- Achievement badges

### Analytics (`/analytics`)

CEO/Admin analytics dashboard:
- Key metrics with trends
- Oracle AI insights
- Conversion funnel
- A/B test status
- Exam-wise performance

### Content (`/content`)

Admin content management:
- Content library with filters
- Atlas AI content generator
- Publishing status pipeline
- SEO and engagement metrics

### Students (`/students`)

Teacher student management:
- Class statistics
- Mentor AI recommendations
- Student list with risk indicators
- Individual student details
- Communication actions

### Agents (`/agents`)

Agent monitoring:
- All 7 agents with sub-agents
- Real-time status indicators
- Token usage and metrics
- Activity logs

### Chat (`/chat`)

AI conversation interface:
- Sage AI tutor
- Topic-aware conversations
- Message history
- Quick topic selection

## State Management

### useAppStore

```typescript
// Get current role
const { userRole, setUserRole } = useAppStore();

// Switch role
setUserRole('student'); // 'ceo' | 'admin' | 'teacher' | 'student'

// Role persists in localStorage
```

### Theme

```typescript
const { theme, toggleTheme } = useAppStore();
// 'light' | 'dark'
```

## Component Structure

```
frontend/src/
├── components/
│   └── layout/
│       ├── Header.tsx      # Top bar with role switcher
│       ├── Sidebar.tsx     # Navigation (adapts to role)
│       └── Layout.tsx      # Main layout wrapper
├── pages/
│   ├── Dashboard.tsx       # Role-based dashboard
│   ├── Learn.tsx           # Student learning
│   ├── Notebook.tsx        # Smart notebook
│   ├── Progress.tsx        # Progress tracking
│   ├── Analytics.tsx       # Business analytics
│   ├── Content.tsx         # Content management
│   ├── Students.tsx        # Teacher view
│   ├── Agents.tsx          # Agent monitoring
│   ├── Chat.tsx            # AI chat
│   └── RolePreview.tsx     # Role selection page
├── stores/
│   ├── appStore.ts         # Main state
│   └── chatStore.ts        # Chat state
└── types/
    └── index.ts            # TypeScript types
```

## AI Integration Points

Each page integrates with AI agents:

| Page | Agent | Integration |
|------|-------|-------------|
| Learn | Sage | Topic recommendations |
| Notebook | Sage | Equation solving |
| Progress | Oracle | Learning insights |
| Analytics | Oracle | Business insights |
| Content | Atlas | Content generation |
| Students | Mentor | At-risk alerts |
| Chat | Sage | Conversational tutoring |
| Agents | All | Status monitoring |

## Styling

### Tailwind Theme

Custom colors defined in `tailwind.config.js`:

```js
colors: {
  primary: { 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
  accent: { 400: '#F472B6', 500: '#EC4899', 600: '#DB2777' },
  surface: { 700: '#374151', 800: '#1F2937', 900: '#111827' },
}
```

### CSS Classes

```css
.card       /* Glass-morphism card */
.btn        /* Button base */
.btn-primary /* Primary button */
.btn-sm     /* Small button */
.input      /* Text input */
.glass      /* Glass effect */
```

## Building for Production

```bash
npm run build
```

Output in `dist/` directory. Deploy to any static hosting:
- Vercel
- Netlify
- GitHub Pages
- S3 + CloudFront

## Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Best Practices

1. **Role switching**: Use for demos and testing, not production auth
2. **Mock data**: Frontend uses mock data; connect to API for real data
3. **Responsive**: All pages are mobile-friendly
4. **Accessibility**: Semantic HTML and ARIA labels used
5. **Performance**: Code-split by route, lazy-load heavy components
