# PJP HARDWARE - Inventory Management System

A web-based inventory management system developed for PJP Hardware Store. The system handles product inventory, sales recording, stock reservations, customer management, and user access control. It is built on a modern client-side stack connected to a cloud-hosted PostgreSQL database with real-time capabilities.

---

## Project Purpose

This system was developed to address the manual record-keeping limitations of a hardware store environment. Prior to this system, inventory tracking, reservation handling, and sales recording were done on paper or through spreadsheets, which made it difficult to track stock levels accurately and led to fulfillment errors.

The system provides a centralized digital platform where staff can log sales, manage product stock, handle customer reservations, and view business analytics in real time.

---

## Technology Stack

### Frontend

- **React 18** with TypeScript for component-based UI development
- **Vite** as the build tool and local development server
- **Chart.js** with `react-chartjs-2` for rendering analytics charts
- **Lucide React** for consistent icon rendering throughout the interface
- **Vanilla CSS** with custom CSS variables for theming and glassmorphism UI design
- **CSS Grid and Flexbox** for responsive layout across all screen sizes

### Backend and Database

- **Supabase** (hosted PostgreSQL) for the relational database, authentication, and real-time subscriptions
- **Supabase Auth** for secure, token-based user session management
- **Row-Level Security (RLS)** enforced at the database level for data access control
- **PostgreSQL RPC Functions** for admin-level operations like password and username changes that require elevated database privileges

---

## System Architecture

The system follows a **client-only architecture**, meaning there is no separate backend server or REST API layer. The React frontend communicates directly with Supabase through its JavaScript client library. All business logic validation happens at the database level through RLS policies and RPC functions.

```
Browser (React + TypeScript)
        |
        | Supabase JS Client (HTTPS)
        |
Supabase Cloud (PostgreSQL + Auth + Realtime)
        |
   Database Tables
   - profiles
   - products
   - customers
   - sales
   - reservations
```

Real-time subscriptions allow the frontend to receive live updates when any record changes in the database. This means that if one staff member records a sale, other logged-in users see the inventory count update without refreshing the page.

---

## Database Design

The database is structured around five tables:

### profiles

Extends Supabase's built-in `auth.users` table. Every authenticated user has a corresponding profile row that stores their display name, username, and system role.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key, references auth.users |
| name | text | Full display name |
| username | text | Unique login username |
| role | text | One of: Admin, Manager, Cashier |
| updated_at | timestamptz | Timestamp of last update |

### products

Stores all hardware product records.

| Column | Type | Description |
|---|---|---|
| product_id | bigint | Auto-generated primary key |
| product_name | text | Product label |
| unit | text | Unit type such as piece, roll, box |
| price | numeric | Unit selling price |
| stock | integer | Current available stock |
| reserved_stock | integer | Units currently under reservation |
| created_at | timestamptz | Record creation time |

### customers

Stores unique customer names used across sales and reservations.

| Column | Type | Description |
|---|---|---|
| customer_id | bigint | Auto-generated primary key |
| name | text | Unique customer name |
| created_at | timestamptz | Record creation time |

### sales

Records each individual sale transaction.

| Column | Type | Description |
|---|---|---|
| sale_id | bigint | Auto-generated primary key |
| product_id | bigint | References products table |
| customer_id | bigint | References customers table |
| quantity | integer | Number of units sold |
| sale_date | date | Date of sale |
| total_amount | numeric | Computed sale total |
| created_at | timestamptz | Record creation time |

### reservations

Tracks product reservations made by customers before final pickup.

| Column | Type | Description |
|---|---|---|
| reservation_id | bigint | Auto-generated primary key |
| product_id | bigint | References products table |
| customer_id | bigint | References customers table |
| quantity | integer | Reserved quantity |
| reservation_date | date | Date reservation was made |
| status | text | One of: Pending, Approved, Claimed, Cancelled |
| created_at | timestamptz | Record creation time |

---

## Row-Level Security

All tables use Supabase Row-Level Security. No unauthenticated user can read or write any data. Access policies are defined per table:

- **profiles** - All authenticated users can read profiles. Users can only update their own profile. Admin users can manage all profiles.
- **products, customers, sales, reservations** - All authenticated staff can perform full CRUD operations on these tables.

---

## Database Triggers and Functions

### Automatic Profile Creation

When a new user is created in Supabase Auth, a PostgreSQL trigger (`on_auth_user_created`) automatically inserts a corresponding row into the `profiles` table using the user's metadata. This eliminates the need for a manual profile setup step after registration.

### Password Change RPC

Admin users can change passwords for any user account through the `update_user_password` RPC function. This function checks the caller's role before performing the update on `auth.users`, which is normally not accessible through the regular client API.

### Username Change RPC

The `update_user_email` function handles username reassignment. It converts the username to an internal email format (`username@ireserve.local`) and updates the underlying auth record while keeping the profile synchronized.

---

## Application Modules

### Login

The login screen handles credential verification through Supabase Auth. The email is reconstructed from the username input using the `@ireserve.local` domain convention, so staff members only need to enter their username rather than a full email address. Upon successful authentication, the user profile is fetched and stored in local application state.

### Dashboard Home

Displays a summary of the current business state:
- Total number of products in inventory
- Total number of sales transactions recorded
- Total number of active reservations
- Total revenue computed from all sales records
- Recent sales activity listed as a scrollable feed
- Low-stock product warnings when any product stock falls below a defined threshold
- A line chart showing daily sales revenue over the past seven days
- A doughnut chart showing the distribution of reservations by status

### Inventory

Allows staff to manage the product catalog:
- Add new products with name, unit type, price, and initial stock quantity
- View all products in a searchable, sortable table
- Edit product details inline
- Adjust stock quantities with increment and decrement controls
- Delete products when they are no longer carried

### Sales

Handles transaction recording:
- Select a product from the current inventory
- Enter or select an existing customer name
- Specify the quantity and sale date
- The system computes the total automatically based on unit price
- Submitted sales deduct from the product's available stock in real time
- Full sales history is shown in a filterable table with date-range search support

### Reservations

Manages the reservation workflow:
- Create a reservation by selecting a product and customer with a quantity
- Reserved stock is tracked separately from available stock to prevent double-allocation
- Staff can update reservation status from Pending to Approved, Claimed, or Cancelled
- When a reservation is claimed, the corresponding stock is formally deducted
- When a reservation is cancelled, the reserved stock is returned to available stock

### Analytics

Provides a visual summary of business performance:
- Line chart for daily revenue trends
- Doughnut chart for reservation status distribution
- Stat cards for total revenue, total sales count, total reservations, and average sale value

### User Settings

Admin-only management panel:
- View all registered staff accounts with their roles
- Create new staff accounts with assigned roles
- Change any user's username or password
- Delete user accounts
- Non-admin users can update their own display name and change their own password

---

## Frontend Design System

The UI is built using a custom glassmorphism design system defined in `index.css`. Key design decisions include:

**Color System**

The primary accent color is a muted sage green (`#66756B`) chosen to represent a hardware and tools aesthetic without being aggressive. The sidebar and deep backgrounds use a dark forest tone (`#2d3b34`). All UI surfaces use semi-transparent white overlays with backdrop blur to create depth.

**Responsive Layout**

The layout is mobile-first. On screens below 768 pixels, the sidebar converts to a slide-out drawer controlled by a hamburger button in the header. All data tables transform into stacked card layouts on mobile viewports using CSS `::before` pseudo-elements for column labels. Form inputs stretch to full width with touch-friendly tap targets.

**Component Hierarchy**

```
App.tsx
  |-- Preloader (loading state)
  |-- Login.tsx (unauthenticated state)
  |-- Sidebar.tsx (navigation)
  |-- Header.tsx (page title + mobile menu)
  |-- [active view component] (authenticated state)
        |-- DashboardHome.tsx
        |-- Inventory.tsx
        |-- Sales.tsx
        |-- Reservations.tsx
        |-- Analytics.tsx
        |-- UserSettings.tsx
```

---

## Setup and Installation

### Requirements

- Node.js version 18 or higher
- A Supabase project with the schema applied

### 1. Clone the Repository

```bash
git clone https://github.com/wow23-glicth/iReserve.git
cd iReserve
```

### 2. Apply the Database Schema

Open your Supabase project dashboard. Navigate to the SQL Editor and paste the full contents of `schema.sql`. Run the script to create all tables, policies, triggers, and functions.

### 3. Configure Environment Variables

Inside the `frontend` directory, create a file named `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Both values are available in your Supabase project settings under Project API.

### 4. Create the First Admin Account

In the Supabase dashboard, navigate to Authentication and create a new user manually. Set the email as `admin@ireserve.local` and set the password. Then go to the SQL Editor and insert a profile record:

```sql
INSERT INTO public.profiles (id, name, username, role)
VALUES (
  'paste-the-auth-user-uuid-here',
  'Administrator',
  'admin',
  'Admin'
);
```

### 5. Run the Development Server

```bash
cd frontend
npm install
npm run dev
```

The application will start at `http://localhost:5173`.

---

## Project File Structure

```
iReserve/
  schema.sql                   Database schema, triggers, and RPC functions
  README.md                    Project documentation
  frontend/
    index.html                 HTML entry point (sets page title and favicon)
    public/
      favicon.png              Browser tab icon
      logo2.png                Company logo asset
    src/
      main.tsx                 React application entry point
      App.tsx                  Root component with session management and routing
      supabaseClient.ts        Supabase client initialization
      index.css                Complete custom design system and responsive styles
      components/
        Header.tsx             Top navigation bar with page title and mobile menu
        Sidebar.tsx            Navigation sidebar with drawer behavior on mobile
      views/
        Login.tsx              Authentication screen
        DashboardHome.tsx      Business summary and charts
        Inventory.tsx          Product catalog management
        Sales.tsx              Sales transaction recording
        Reservations.tsx       Reservation workflow management
        Analytics.tsx          Business analytics and reporting
        UserSettings.tsx       User account management (admin)
```

---

## State Management Approach

The system does not use an external state management library. All application state is handled through React's built-in `useState` and `useEffect` hooks. The authenticated user session is stored in a top-level state variable in `App.tsx` and passed down as props to child components. Page routing is implemented as a single string state variable that determines which view component renders inside the main content area.

This approach was chosen for simplicity. Because the system has a fixed set of views and does not require complex cross-component state sharing beyond the user session, a lightweight prop-based approach is sufficient.

---

## Real-Time Updates

The system uses Supabase's real-time channel subscriptions in the Inventory, Sales, and Reservations modules. Each module opens a WebSocket channel on mount and listens for `INSERT`, `UPDATE`, and `DELETE` events on its corresponding table. When a change event arrives, the local component state is updated immediately without making a full refetch of all records.

---

## Security Considerations

- All database access requires a valid Supabase JWT token
- Row-Level Security policies enforce access rules at the database level regardless of what the frontend sends
- Password changes use a server-side RPC function that verifies the caller's role before modifying `auth.users`
- The anon key used in the frontend only grants access to data explicitly permitted by RLS policies
- No sensitive credentials are stored in frontend source code; all are loaded from environment variables at build time
