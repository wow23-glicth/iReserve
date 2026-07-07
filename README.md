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

## Role-Based Access Control (RBAC)

The frontend application enforces user access boundaries by restricting component rendering, page routing, and search command shortcuts based on the user's role:

- **Cashier**: Can only view and access the Dashboard, Sales, Reservations, and Analytics modules. Restricted sections (Inventory and User Settings) are hidden from the navigation sidebar and the command palette (Ctrl+K). Any manual or programmatic navigation to restricted pages is intercepted and redirected back to the Dashboard.
- **Manager**: Can view and access all sections except User Settings.
- **Admin**: Has unrestricted access to all modules, including user account management (User Settings).

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
- Download the complete inventory list as a CSV export file (Admins and Managers)

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

### 2. Apply the Database Schema and Setup Vault

Open your Supabase project dashboard. Navigate to the SQL Editor and apply the following scripts:
1. Paste the full contents of `schema.sql` and run it to create core tables, policies, triggers, and functions.
2. Paste the contents of `security_schema.sql` and run it to configure audit logs and tightened RLS policies.
3. Paste the contents of `vault_setup.sql` and run it. This stores the AES-256-GCM encryption key securely in Supabase Vault and registers the `get_encryption_key()` RPC function.

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

### 6. Deploying to Vercel

If you deploy this project to Vercel, configure the following settings in your Vercel project setup:

* **Framework Preset**: `Vite`
* **Root Directory**: `frontend` (this is critical since the React/Vite app is located inside the subfolder)
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment Variables**: Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the project settings.

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

## Security Architecture

This section documents the full security layer applied to the system. Each mechanism targets a distinct attack surface.

---

### Transport Security

All communication between the frontend and Supabase travels over HTTPS. The Supabase client library enforces TLS on every API call and WebSocket connection. No data is transmitted in plaintext.

---

### Authentication and Session Management

Supabase Auth issues signed JWT tokens on login. Every API request includes this token in the Authorization header. The token is verified by Supabase on every request before any database operation is permitted. Sessions expire automatically, and the client library handles token refresh transparently.

---

### Field-Level Encryption (AES-GCM 256-bit)

**File:** `frontend/src/utils/crypto.ts`

Customer names are classified as personally identifiable information (PII). Before a customer name is written to the `customers` table, it is encrypted using AES-GCM with a 256-bit key. When a record is read back, it is decrypted in the browser before being displayed.

This means that anyone with direct database access — including database administrators — sees only ciphertext in the `name` column, not the actual customer name.

The implementation uses the browser's native **Web Crypto API** with no third-party cryptographic libraries. Key properties:

- Algorithm: AES-GCM
- Key length: 256 bits
- IV: 96-bit random value generated per encryption operation
- Storage format: `ivHex:cipherBase64`

A new random IV is generated for every write operation. This guarantees that encrypting the same customer name twice produces a different ciphertext each time, preventing frequency analysis.

**Key Management**

The encryption key is stored securely in **Supabase Vault** (powered by `pgsodium`). At runtime, the frontend requests the key by executing the `get_encryption_key()` RPC function. This function uses `security definer` to safely decrypt the secret on the database side and return it, but only if the user is authenticated. 

Once fetched, the key is stored in a module-level variable in the browser's memory and is cleared upon logout. This ensures that the encryption key never resides in local storage or is built directly into client-side JS bundles.

To generate a new key if you need to rotate it:

```bash
node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'));"
```

Then update the vault entry using:
```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'field_encryption_key'),
  'YOUR_NEW_BASE64_KEY'
);
```

---

### Audit Log

**File:** `security_schema.sql`

Every `INSERT`, `UPDATE`, and `DELETE` operation on the five core tables is recorded automatically by a PostgreSQL trigger function. The audit log captures:

| Column | Description |
|---|---|
| table_name | The table where the change occurred |
| operation | INSERT, UPDATE, or DELETE |
| record_id | The primary key of the affected row |
| changed_by | The UUID of the authenticated user who made the change |
| changed_at | UTC timestamp of the operation |
| old_data | Full JSON snapshot of the row before the change |
| new_data | Full JSON snapshot of the row after the change |

The trigger uses `security definer` to write to the audit table regardless of the caller's permissions. No client-side code can insert, update, or delete audit log rows. The RLS policy on `audit_log` allows authenticated users to read it but not modify it.

---

### Scoped Row-Level Security Policies

The original RLS policies granted all authenticated staff full `INSERT`, `UPDATE`, and `DELETE` access to all tables. These have been tightened:

- `DELETE` on the `products` table is restricted to the `Admin` role only
- `DELETE` on the `sales` table is restricted to the `Admin` role only. Sales records are treated as an immutable financial ledger. Regular staff and managers cannot remove transactions.
- `SELECT` and `INSERT` on products and sales remain available to all authenticated staff

---

### Browser Security Headers

The following HTTP security headers are declared as `<meta>` tags in `index.html`. They instruct the browser to enforce strict content policies regardless of server configuration.

| Header | Effect |
|---|---|
| Content-Security-Policy | Restricts script and style sources to known origins. Blocks inline JavaScript injection (XSS). Disallows framing by external pages (clickjacking). |
| X-Content-Type-Options: nosniff | Prevents the browser from MIME-sniffing responses and executing them as an unintended content type. |
| Referrer-Policy: strict-origin-when-cross-origin | Limits the URL information sent to external servers in the Referer header. |
| Permissions-Policy | Disables access to camera, microphone, and geolocation APIs at the browser level. |

The Content Security Policy `connect-src` directive limits outbound API calls to the specific Supabase project URL and its WebSocket endpoint only. No other external domains can receive data from the browser.

---

### Database Encryption at Rest

Supabase encrypts all data at rest using AES-256 at the storage volume level. This is managed by the cloud infrastructure and applies to all table rows, including those not covered by field-level encryption. The field-level encryption layer described above provides an additional independent protection on top of this.

---

### Environment Variable Discipline

The following values are never committed to version control:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Both are read from `frontend/.env.local` at development time. Before deploying to a production hosting environment, these must be set as environment variables in the hosting platform's configuration.

---

### Security Files Added

| File | Purpose |
|---|---|
| `frontend/src/utils/crypto.ts` | AES-GCM field-level encryption and decryption functions with runtime Supabase Vault integration |
| `security_schema.sql` | Audit log table, trigger function, and scoped RLS policy definitions |
| `vault_setup.sql` | Database setup for Supabase Vault secrets and the authenticated RPC function |
