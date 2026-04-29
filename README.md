# 🌟 ARC APPLICATION - COMPLETE ANALYSIS

A **production-ready full-stack sports facility booking system** with membership management, real-time updates, comprehensive inventory tracking, and full admin controls. Built with React, Node.js/Express, and MySQL.

---

## ✨ FEATURES

✅ **User Authentication** – Secure JWT-based login with bcrypt password hashing
✅ **Role-Based Access Control** – Admin, Desk, Staff roles with permission tiers
✅ **Booking Management** – Create, reschedule, extend, and cancel court bookings
✅ **Price Calculation** – Dynamic pricing with accessories, discounts, and slots
✅ **Payment Processing** – Partial/full payments with multiple payment modes (cash/online)
✅ **Membership System** – Team-based subscriptions with renewal & termination
✅ **Attendance Tracking** – Daily member check-in with leave management
✅ **Inventory & POS** – Standalone sales/rentals, stock tracking, damage handling, and audit logs
✅ **Real-Time Updates** – SSE (Server-Sent Events) for live notifications
✅ **Analytics & Reports** – Heatmaps, booking trends, revenue, and inventory analytics
✅ **PDF Generation** – Automated receipts and reports for bookings, memberships, and standalone sales
✅ **Facility Holidays** – Closure date management for maintenance & events

---

## 🎨 **FRONTEND DESIGN SYSTEM**

The application uses a centralized design system implemented via CSS Variables (`design-system.css`), ensuring absolute consistency across all modules.

### **Color Palette**
- **Primary Brand**: `#1B3A6B` to `#2E5A99` (Navy Blue Gradient - used for headers and primary CTAs)
- **Accent/Danger**: `#C0392B` to `#E74C3C` (Red Gradient - used for destructive actions)
- **Background**: A subtle, fixed gradient `linear-gradient(to bottom, #F2D4D6, #FAFAFA, #D6E4F0)`
- **Semantic Colors**: 
  - Success: `#1E8449` (Text), `#D5F5E3` (Bg)
  - Warning: `#D4AC0D` (Text), `#FEF9E7` (Bg)
  - Info: `#2E86C1` (Text), `#D6EAF8` (Bg)

### **Typography & Spacing**
- **Font Family**: `Inter`, sans-serif
- **Scale**: `12px` (xs) up to `36px` (4xl)
- **Border Radius**: Highly rounded elements (`--radius-base: 8px`, `--radius-xl: 16px`, `--radius-full: 9999px`)

### **Core UI Components**
- **Buttons (`.btn`)**: Distinct classes for `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`. Includes hover translation `translateY(-1px)` and glow shadows.
- **Modals**: Centered `.modal-content` with an animated slide-in entrance (`@keyframes dsSlideIn`).
- **Forms**: Standardized `.form-group` with floating focus states (`box-shadow: 0 0 0 3px var(--color-primary-glow)`).
- **Cards**: `.summary-card` for highlighted info (e.g., total prices) with a thick left accent border.
- **Feedback**: `.notification-popup` with slide-in/fade-out animations and inline `.message` alerts.

---

## 🛠️ **TECH STACK**

### **Backend**
- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MySQL2 v3.14.3 with connection pooling
- **Authentication**: JWT (jsonwebtoken v9.0.2) + Bcrypt v6.0.0
- **Real-Time**: SSE (Server-Sent Events) for live updates
- **Scheduling**: Node-cron v4.2.1 (automated tasks)
- **PDF Generation**: PDFKit v0.17.2
- **Data Export**: json2csv v6.0.0-alpha.2

### **Frontend**
- **Library**: React v19.1.1
- **Router**: React Router v7.8.2
- **HTTP Client**: Axios v1.11.0 with JWT interceptors
- **Charts**: Chart.js v4.5.0 + react-chartjs-2
- **Date Handling**: date-fns v4.1.0
- **QR Code**: react-qr-code v2.0.18

### **Database**: MySQL 5.7+ (20 tables)

---

## 🗄️ **DATABASE DESIGN (20 TABLES)**

### **Core Booking Tables**
- `users` (id, username, password, role)
- `sports` (id, name, price, capacity)
- `courts` (id, sport_id, name, status)
- `bookings` (id, court_id, date, time_slot, payment_*, status)
- `booking_accessories` (booking_id, accessory_id, transaction_type, quantity)

### **Membership Tables**
- `members` (id, full_name, phone_number)
- `membership_packages` (id, name, duration_days, per_person_price)
- `active_memberships` (id, package_id, start_date, end_date)
- `membership_team` (membership_id, member_id)
- `membership_leave` (id, membership_id, leave_days, status)
- `team_attendance` (id, membership_id, attendance_date)
- `facility_holidays` (id, holiday_date, reason)

### **Inventory & POS Tables (NEW)**
- `accessories` (id, name, price, rent_price, type [for_sale/for_rental/both], stock_quantity)
- `standalone_sales` (id, customer_name, total_amount, payment_status)
- `standalone_sale_items` (sale_id, accessory_id, transaction_type, quantity, price_at_sale)
- `rental_returns` (id, source_type, source_id, accessory_id, item_condition)
- `inventory_stock_log` (id, accessory_id, change_type [sold, restock, discarded], quantity_change)

### **Shared Financial Tables**
- `payments` (id, booking_id, membership_id, standalone_sale_id, amount, payment_mode)

---

## 🌐 **API ENDPOINTS (50+)**

### **Inventory & POS (NEW)**
```http
GET    /api/inventory/accessories            → List all accessories with stock counts
POST   /api/inventory/accessories            → Add new accessory
POST   /api/inventory/accessories/:id/restock→ Update stock quantity (Logs to audit)
POST   /api/inventory/accessories/:id/discard→ Mark items as damaged/discarded
GET    /api/inventory/standalone-sales       → List all walk-in POS sales
POST   /api/inventory/standalone-sales       → Create walk-in sale/rental transaction
POST   /api/inventory/standalone-sales/:id/payment → Process balance payment
GET    /api/inventory/returns/pending        → List all unreturned rented items
POST   /api/inventory/returns                → Process item return (with optional damage fee)
GET    /api/inventory/analytics/summary      → Get core stock and revenue KPIs
GET    /api/inventory/accessories/stock-log  → Complete audit trail of inventory movement
```

### **Bookings & Core**
```http
POST   /api/login                           → User login & JWT generation
GET    /api/courts                          → List all courts with details
GET    /api/bookings/all                    → List all bookings (paginated, filterable)
POST   /api/bookings                        → Create new booking
POST   /api/bookings/calculate-price        → Calculate booking price
PUT    /api/bookings/:id/payment            → Process payment
POST   /api/bookings/:id/extend             → Extend booking duration
```

### **Memberships**
```http
GET    /api/memberships/packages            → List all packages
POST   /api/memberships/subscribe           → Create new membership
GET    /api/memberships/active              → Get active memberships
PUT    /api/memberships/active/:id/renew    → Renew membership
POST   /api/memberships/team-attendance     → Mark attendance
POST   /api/memberships/grant-leave         → Request/Approve leave
```

---

## 🧩 **MODULES & FRONTEND COMPONENTS (40+)**

The frontend is neatly divided into specific operational modules:

### **1. Booking Module**
- **Components**: `Dashboard.js`, `BookingForm.js`, `BookingList.js`, `EditBookingModal.js`, `AvailabilityHeatmap.js`
- **Functionality**: Core daily operations. Heatmap integration for visualizing empty slots. Handles dynamic calculation of slot pricing and equipment addition.

### **2. Membership Module**
- **Components**: `MembershipDashboard.js`, `ActiveMembershipsMgt.js`, `NewSubscription.js`, `LeaveRequests.js`, `HolidayMgt.js`
- **Functionality**: Long-term team subscriptions. Handles complex date logic, automated attendance scaling, leave compensations, and recurring payments.

### **3. Inventory & POS Module (NEW)**
- **Components**: 
  - `InventoryDashboard.js`: The central hub holding sub-tabs.
  - `StandalonePos.js`: A specialized Point-of-Sale UI for walk-in customers buying/renting gear.
  - `StockManagement.js`: Admin grid to restock or discard items, enforcing audit logging.
  - `RentalReturns.js`: View pending rentals (from both Bookings and POS) and process returns.
  - `InventoryAnalytics.js`: Charts breaking down revenue and stock alerts.
- **Functionality**: Separates physical item sales from court bookings. Maintains a strict `inventory_stock_log` ledger for loss prevention.

### **4. Ledger & Financial Module**
- **Components**: `Ledger.js`, `ReceiptModal.js`, `MembershipReceiptModal.js`, `StandaloneReceiptModal.js`
- **Functionality**: Unified view of all financial transactions across Bookings, Memberships, and Standalone Sales. Handles partial payment tracking.

### **5. Analytics Module**
- **Components**: `Analytics.js`, `DeskAnalytics.js`
- **Functionality**: Chart.js integration showing revenue over time, popular court utilization, and staff performance metrics.

### **6. Admin & Layout**
- **Components**: `App.js` (Routing), `Header.js`, `Login.js`, `Admin.js`
- **Functionality**: JWT interceptors, Protected Route wrappers, User credential management.

---

## 🏗️ **SYSTEM ARCHITECTURE**

```text
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                            │
│  ├─ Modules (Bookings, Memberships, Inventory, Ledger, Admin)    │
│  ├─ Routing: React Router v7.8.2                                 │
│  ├─ HTTP: Axios with JWT interceptors                            │
│  └─ Design System: CSS Variables (design-system.css)             │
└──────────────────────────────────────────────────────────────────┘
                              △
                              │ HTTP/REST + JWT + SSE
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js/Express)                        │
│  ├─ Routes (Express Router)                                      │
│  │  ├─ /api/bookings, /api/memberships, /api/inventory           │
│  ├─ Middleware (JWT Auth, RBAC, Rate Limiting)                   │
│  ├─ Business Logic (Availability, Stock Ledgers, Leaves)         │
│  └─ Utilities (PDF Generation, Event Streams)                    │
└──────────────────────────────────────────────────────────────────┘
                              △
                              │ MySQL2 Promise Pool
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              DATABASE (MySQL - 20 Tables)                        │
│  Core: users, sports, courts, bookings                           │
│  Memberships: packages, active_memberships, attendance           │
│  Inventory: accessories, standalone_sales, stock_log             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📈 **KEY WORKFLOWS**

### **1. Daily Walk-in Bookings Flow**
1. **Court Selection**: User clicks on an available slot in the Dashboard Heatmap or selects a court/time in the BookingForm.
2. **Dynamic Pricing**: The frontend sends the court, duration, and selected accessories to `POST /api/bookings/calculate-price`. The backend applies logic (like slot lengths and accessory costs) and returns the total.
3. **Transaction**: The user provides customer details and payment (Partial or Full).
4. **Validation & Creation**: `POST /api/bookings` verifies the slot hasn't been taken (preventing double-booking). The booking and a `payments` record are created within an atomic SQL transaction.
5. **Real-time Broadcast**: The backend triggers an SSE event. All connected frontends instantly update the court status grid.
6. **Receipt Generation**: The frontend can immediately fetch a PDF receipt generated by PDFKit on the backend.

### **2. Membership Module Flow**
1. **Package Setup**: Admin defines subscription templates (e.g., "1 Month Badminton") setting `duration_days` and `per_person_price`.
2. **Team Assembly**: Desk staff selects a package, picks a dedicated court and time slot, and assigns registered `members` to the new `active_memberships` record.
3. **Daily Attendance**: Members show up. Desk staff clicks "Mark Attendance". A record is added to `team_attendance` to track usage.
4. **Leave Management**: If the team goes on vacation, they request leave. Desk staff approves it, which pauses their membership and automatically pushes their `current_end_date` forward by the approved days.
5. **Renewal**: At the end of the term, staff hits Renew, carrying over the team and generating a new payment ledger while maintaining the history.

### **3. Inventory & POS Flow**
1. **Admin Setup**: Admin creates accessories setting `type` (`for_sale`, `for_rental`, or `both`) and logs initial `stock_quantity`.
2. **Walk-in POS**: Desk staff uses the Standalone POS UI. If an item is `both`, the UI prompts the staff to select the specific transaction type (Rent vs Sale) to apply the correct pricing.
3. **Transaction**: The sale records to `standalone_sales` and `standalone_sale_items`.
4. **Stock Ledger**: The backend immediately inserts an immutable record into `inventory_stock_log` (e.g., `-1 rented_out`).
5. **Rental Return**: When the customer returns the item, staff processes it via `RentalReturns.js`. The item is placed back in `available_quantity`, and a `returned` log is generated.

---

## 🚀 **SETUP INSTRUCTIONS**

### **1️⃣ Backend Setup**
```bash
cd server
npm install
```
Create `.env` file:
```ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=arc
DB_PORT=3306
JWT_SECRET=your_secret_key_here
PORT=5000
```
Initialize database:
```bash
mysql -u root -p < db.sql
mysql -u root -p < membership.sql
mysql -u root -p < inventory.sql
```
Start server: `npm run dev`

### **2️⃣ Frontend Setup**
```bash
cd client
npm install
```
Create `.env` file:
```ini
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_RECIEPT_URL=http://localhost:5000
```
Start frontend: `npm start`
