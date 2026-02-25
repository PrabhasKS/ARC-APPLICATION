# 🌟 ARC APPLICATION - COMPLETE ANALYSIS

A **production-ready full-stack sports facility booking system** with membership management, real-time updates, and comprehensive admin controls. Built with React, Node.js/Express, and MySQL.

---

## ✨ FEATURES

✅ **User Authentication** – Secure JWT-based login with bcrypt password hashing
✅ **Role-Based Access Control** – Admin, Desk, Staff roles with permission tiers
✅ **Booking Management** – Create, reschedule, extend, and cancel court bookings
✅ **Price Calculation** – Dynamic pricing with accessories, discounts, and slots
✅ **Payment Processing** – Partial/full payments with multiple payment modes (cash/online)
✅ **Membership System** – Team-based subscriptions with renewal & termination
✅ **Attendance Tracking** – Daily member check-in with leave management
✅ **Real-Time Updates** – SSE (Server-Sent Events) for live notifications
✅ **Analytics & Reports** – Heatmaps, booking trends, revenue analytics
✅ **PDF Generation** – Automated receipts and reports
✅ **Admin Panel** – User management, court status control, system configuration
✅ **Facility Holidays** – Closure date management for maintenance & events

---

## 🛠️ **TECH STACK**

### **Backend**
- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MySQL2 v3.14.3 with connection pooling
- **Authentication**: JWT (jsonwebtoken v9.0.2) + Bcrypt v6.0.0
- **Real-Time**: SSE (Server-Sent Events) for live updates
- **Scheduling**: Node-cron v4.2.1 (automated tasks)
- **SMS/Notifications**: Twilio v5.8.2
- **PDF Generation**: PDFKit v0.17.2
- **Data Export**: json2csv v6.0.0-alpha.2
- **Dev Tool**: Nodemon v3.1.10

### **Frontend**
- **Library**: React v19.1.1
- **Router**: React Router v7.8.2
- **HTTP Client**: Axios v1.11.0 with JWT interceptors
- **Charts**: Chart.js v4.5.0 + react-chartjs-2
- **Date Handling**: date-fns v4.1.0
- **QR Code**: react-qr-code v2.0.18
- **JWT Decode**: jwt-decode v4.0.0
- **Testing**: Jest + React Testing Library
- **Styling**: CSS

### **Database**: MySQL 5.7+ (14 tables)

---

## � **DATABASE DESIGN - ER DIAGRAM (14 TABLES)**

### **Core Booking Tables (6)**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │────▶│   bookings   │◀────│   courts     │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ username (U) │     │ court_id (FK)│     │ sport_id(FK) │
│ password     │     │ sport_id (FK)│     │ name         │
│ role         │     │ created_by   │     │ status       │
└──────────────┘     │ customer_*   │     └──────────────┘
                     │ date         │
                     │ time_slot    │     ┌──────────────┐
                     │ status       │────▶│ accessories  │
                     │ payment_*    │     ├──────────────┤
                     │ discount_*   │     │ id (PK)      │
                     │ is_reschedule│     │ name         │
                     └──────┬───────┘     │ price        │
                            │             └──────────────┘
                     ┌──────▼──────────────┐
                     │booking_accessories  │
                     ├─────────────────────┤
                     │ id (PK)             │
                     │ booking_id (FK)     │
                     │ accessory_id (FK)   │
                     │ quantity            │
                     │ price_at_booking    │
                     └─────────────────────┘
```

### **Membership Tables (7)**
```
┌─────────────────┐     ┌─────────────────────┐
│ members         │────▶│ active_memberships  │
├─────────────────┤     ├─────────────────────┤
│ id (PK)         │     │ id (PK)             │
│ full_name       │     │ package_id (FK)     │
│ phone_number(U) │     │ court_id (FK)       │
│ email           │     │ start_date          │
│ notes           │     │ original_end_date   │
└────────┬────────┘     │ current_end_date    │
         │              │ time_slot           │
         │              │ final_price         │
         │              │ amount_paid         │
         │              │ balance_amount      │
         │              │ payment_status      │
         │              │ status              │
         │              │ created_by_user_id  │
         │              └──────┬──────────────┘
         │                     │
    ┌────▼──────────────┐      │  ┌────────────────────┐
    │ membership_team   │      │  │membership_packages │
    ├───────────────────┤      │  ├────────────────────┤
    │ membership_id(FK) │      │  │ id (PK)            │
    │ member_id(FK)     │      │  │ name               │
    └───────────────────┘      │  │ sport_id (FK)      │
                               │  │ duration_days      |
                                  | per_person_price   |
                                  | max_team_size      |
                                  └────────────────────┘

                     ┌─────────▼──────────────┐ 
                     │ membership_leave       │ 
                     ├────────────────────────┤
                     │ id (PK)                │
                     │ membership_id (FK)     │
                     │ leave_days             │
                     │ reason                 │
                     │ status                 │
                     │ compensation_applied   │
                     │ start_date             │
                     │ end_date               │
                     │ approved_by_user_id(FK)│
                     └────────────────────────┘

    ┌──────────────────────────┐
    │ team_attendance          │
    ├──────────────────────────┤
    │ id (PK)                  │
    │ membership_id (FK)       │
    │ attendance_date          │
    │ marked_by_user_id (FK)   │
    │ created_at               │
    └──────────────────────────┘

    ┌──────────────────────────┐
    │ facility_holidays        │
    ├──────────────────────────┤
    │ id (PK)                  │
    │ holiday_date (UNIQUE)    │
    │ reason                   │
    └──────────────────────────┘
```

### **Payment & Sports Tables**
```
┌──────────────┐     ┌──────────────────┐
│   sports     │────▶│   payments       │
├──────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)          │
│ name         │     │ booking_id (FK)  │
│ price        │     │ membership_id(FK)│
│ capacity     │     │ amount           │
└──────────────┘     │ payment_mode     │
                     │ payment_date     │
                     │ payment_id       │
                     │ created_by_user  │
                     └──────────────────┘
```

### **Table Descriptions**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **users** | Authentication & authorization | id, username, password, role |
| **sports** | Sport types (Badminton, Turf, etc.) | id, name, price, capacity |
| **courts** | Individual courts/facilities | id, sport_id, name, status |
| **bookings** | Daily court bookings | id, court_id, date, time_slot, customer_*, payment_* |
| **booking_accessories** | Equipment/accessories for bookings | booking_id, accessory_id, quantity, price_at_booking |
| **accessories** | Available equipment | id, name, price |
| **members** | Individual team members | id, full_name, phone_number, email |
| **membership_packages** | Subscription plan templates | id, name, sport_id, duration_days, per_person_price |
| **active_memberships** | Active team subscriptions | id, package_id, court_id, dates, payment_*, status |
| **membership_team** | Links members to memberships | membership_id, member_id (composite PK) |
| **membership_leave** | Emergency/leave requests | id, membership_id, leave_days, status, compensation |
| **team_attendance** | Daily member attendance | id, membership_id, attendance_date, marked_by |
| **facility_holidays** | Closure dates | id, holiday_date, reason |
| **payments** | Payment transactions | id, booking_id OR membership_id, amount, payment_mode |

---

## � **API ENDPOINTS (40+)**

### **Authentication**
```
POST   /api/login                           → User login & JWT generation
```

### **User Management (Admin Only)**
```
POST   /api/admin/users                     → Create new user
GET    /api/admin/users                     → List all users
DELETE /api/admin/users/:id                 → Delete user
```

### **Sports & Courts**
```
GET    /api/sports                          → List all sports
GET    /api/courts                          → List all courts with details
GET    /api/courts/availability             → Check court availability (date/time)
PUT    /api/courts/:id/status               → Update court status
```

### **Booking Management - Retrieve**
```
GET    /api/events                          → SSE stream for real-time updates
GET    /api/bookings                        → Get bookings for specific date
GET    /api/bookings/all                    → List all bookings (paginated, filterable)
GET    /api/bookings/active                 → Get active bookings
GET    /api/booking/:id/receipt.pdf         → Download booking receipt (PDF)
GET    /api/availability/heatmap            → Availability heatmap analytics
```

### **Booking Management - Create & Modify**
```
POST   /api/bookings                        → Create new booking
POST   /api/bookings/calculate-price        → Calculate booking price
PUT    /api/bookings/:id                    → Update booking
PUT    /api/bookings/:id/payment            → Process payment
POST   /api/bookings/:id/payments           → Record partial/full payments
POST   /api/bookings/:id/extend             → Extend booking duration
PUT    /api/bookings/:id/cancel             → Cancel booking (Admin only)
```

### **Membership Packages (Admin)**
```
GET    /api/memberships/packages            → List all packages
GET    /api/memberships/packages/:id        → Get specific package
POST   /api/memberships/packages            → Create package
PUT    /api/memberships/packages/:id        → Update package
DELETE /api/memberships/packages/:id        → Delete package
```

### **Members Management**
```
POST   /api/memberships/members             → Create new member
GET    /api/memberships/members             → Search/list members
PUT    /api/memberships/members/:id         → Update member
DELETE /api/memberships/members/:id         → Delete member
```

### **Membership Subscriptions**
```
POST   /api/memberships/check-clash         → Check time slot conflicts
POST   /api/memberships/subscribe           → Create new membership
GET    /api/memberships/active              → Get active memberships
GET    /api/memberships/ended               → Get expired memberships
GET    /api/memberships/terminated          → Get terminated memberships
DELETE /api/memberships/active/:id          → Delete membership
PUT    /api/memberships/active/:id/renew    → Renew membership
PUT    /api/memberships/active/:id/manage-members → Update team members
POST   /api/memberships/active/:id/add-member    → Add member to team
PUT    /api/memberships/ended/:id/terminate     → Terminate membership
POST   /api/memberships/active/:id/payments     → Record membership payment
GET    /api/memberships/:id/receipt.pdf    → Download membership receipt
```

### **Attendance & Leave Management**
```
POST   /api/memberships/team-attendance     → Mark attendance
GET    /api/memberships/team-attendance     → Get attendance records
GET    /api/memberships/active/:id/attendance-history → Team history
POST   /api/memberships/request-leave       → Request leave
PUT    /api/memberships/leave-requests/:id  → Update leave request
POST   /api/memberships/grant-leave         → Approve leave request
GET    /api/memberships/leave-requests      → List leave requests
GET    /api/memberships/on-leave            → Get members on leave
GET    /api/memberships/active/:id/leave-history    → Leave history
```

### **Facility Management**
```
GET    /api/memberships/holidays            → List facility holidays
POST   /api/memberships/holidays            → Add holiday
DELETE /api/memberships/holidays/:id        → Remove holiday
```

### **Details & Analytics**
```
GET    /api/memberships/:id/details         → Get membership full details
```

---

## � **FRONTEND COMPONENTS (30+)**

### **Authentication & Layout**
- `Login.js` - User login page with JWT
- `Header.js` - Navigation bar & user info

### **Core Pages**
- `Dashboard.js` - Main dashboard (protected)
- `Ledger.js` - Booking & transaction history
- `Admin.js` - Admin panel (user & system management)
- `Analytics.js` - Business analytics & reports

### **Booking Components**
- `BookingForm.js` - Create new booking
- `BookingList.js` - Display bookings
- `ActiveBookings.js` - Show active bookings
- `BookingDetailsModal.js` - Booking details modal
- `EditBookingModal.js` - Edit booking modal
- `ReceiptModal.js` - Receipt display
- `AvailabilityHeatmap.js` - Court availability heatmap
- `CourtActions.js` - Court action buttons
- `CourtStatusControl.js` - Update court status
- `DashboardCourtStatusToggle.js` - Court toggle widget

### **Membership Components**
- `MembershipDashboard.js` - Membership hub
- `MembershipView.js` - View membership details
- `NewSubscription.js` - Create new membership
- `ActiveMembershipsMgt.js` - Manage active memberships
- `PackageMgt.js` - Manage packages
- `PackageEditModal.js` - Edit package modal
- `AddMemberModal.js` - Add member modal
- `AddMembershipPaymentModal.js` - Record payment modal
- `ManageActiveMembersModal.js` - Manage team modal
- `AddTeamMemberModal.js` - Add team member modal
- `RenewModal.js` - Renewal form modal
- `RenewalConfirmationModal.js` - Renewal confirmation
- `LeaveRequests.js` - Manage leave requests
- `MarkLeaveModal.js` - Mark/approve leave modal
- `AttendanceCalendarModal.js` - Attendance tracking
- `HolidayMgt.js` - Facility holiday management
- `MembershipReceiptModal.js` - Membership receipt modal

### **Analytics & UI**
- `DeskAnalytics.js` - Desk-level analytics
- `Pagination.js` - Pagination component
- `ConfirmationModal.js` - Confirmation dialogs

---

## 🏗️ **SYSTEM ARCHITECTURE**

```
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                            │
│  ├─ Components (Dashboard, Bookings, Memberships, Admin)         │
│  ├─ Routing: React Router v7.8.2                                 │
│  ├─ HTTP: Axios with JWT interceptors                            │
│  └─ State: Component-level useState/useContext                   │
└──────────────────────────────────────────────────────────────────┘
                              △
                              │ HTTP/REST + JWT + SSE
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js/Express)                        │
│  ├─ Routes (Express Router)                                       │
│  │  ├─ /api/login, /api/bookings/*                              │
│  │  ├─ /api/courts/*, /api/sports/*                             │
│  │  ├─ /api/admin/users                                          │
│  │  └─ /api/memberships/* (subscriptions, leaves)                │
│  ├─ Middleware (JWT Auth, RBAC, CORS)                            │
│  ├─ Business Logic (availability, pricing, payments)             │
│  └─ External Integrations (Twilio, PDFs, Payments)               │
└──────────────────────────────────────────────────────────────────┘
                              △
                              │ MySQL Protocol
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              DATABASE (MySQL with Pooling)                       │
│  Core: users, sports, courts, bookings, booking_accessories     │
│  Memberships: members, packages, active_memberships, team,      │
│  leave, attendance, holidays, payments                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔐 **AUTHENTICATION & AUTHORIZATION**

### **Authentication Flow**
1. User submits `username` + `password` → `POST /api/login`
2. Backend verifies password using **Bcrypt**
3. Backend generates **JWT token** with 7-day expiration
4. Client stores token in **localStorage**
5. Axios interceptor automatically includes token in `Authorization: Bearer <token>` header
6. Token verified on every protected route

### **Role-Based Access Control (RBAC)**
```javascript
Roles:
├─ admin        → Full system access (users, settings, all operations)
├─ desk         → Desk operations (bookings, memberships, staff management)
└─ staff        → Limited access (view bookings, generate reports)

Middleware Protection:
├─ authenticateToken  → Validates JWT on all protected routes
├─ isAdmin           → Restricts to admin role only
└─ isPrivilegedUser  → Allows admin + desk roles
```

---

## 📈 **KEY WORKFLOWS**

### **Booking Creation Flow**
```
1. User selects court, date, time, adds accessories
2. Frontend calls POST /api/bookings/calculate-price
3. Backend calculates: base_price + accessories - discount
4. User confirms booking
5. Frontend calls POST /api/bookings
6. Backend checks availability (no overlaps)
7. Backend inserts booking + payment record
8. Backend broadcasts SSE update to all clients
9. Frontend generates receipt & confirmation
```

### **Membership Creation Flow**
```
1. Admin creates membership package with pricing
2. Desk staff searches for/adds members
3. Desk staff creates new subscription:
   - Selects package, court, time slot
   - Starts date & duration auto-calculated
   - Team members assigned
4. Backend validates time slot (no clashes)
5. Backend calculates total price
6. Payment recorded (partial or full)
7. Team attendance tracking enabled
```

### **Leave Management Flow**
```
1. Member requests leave (emergency/vacation)
2. Request stored as PENDING
3. Desk staff reviews & approves/rejects
4. If approved: compensation applied, leave days tracked
5. Member attendance skipped for leave dates
6. Leaves counted toward renewal compensation
```

---

## 📦 **PREREQUISITES**

- [Node.js](https://nodejs.org/) (v14+, includes npm)
- [MySQL](https://www.mysql.com/downloads/) (v5.7+)

---

## 🚀 **SETUP INSTRUCTIONS**

### **1️⃣ Clone Repository**
```bash
git clone <your-repository-url>
cd ARC-APPLICATION
```

### **2️⃣ Backend Setup**
```bash
cd server
npm install
```

Create `.env` file:
```ini
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=sports_booking
DB_PORT=3306
JWT_SECRET=your_secret_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
PORT=5000
```

Initialize database:
```bash
mysql -u your_username -p < db.sql
mysql -u your_username -p < migrations.sql
mysql -u your_username -p < membership.sql
```

Start server:
```bash
npm start          # Production
npm run dev        # Development (nodemon)
```

### **3️⃣ Frontend Setup**
```bash
cd client
npm install
npm start          # Runs on http://localhost:3000
npm run build      # Build for production
```

---

## 📜 **ENVIRONMENT VARIABLES**

### **Server (.env)**
```ini
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=sports_booking
DB_PORT=3306

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Server
PORT=5000
NODE_ENV=production
```

### **Client (.env)**
```ini
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🎯 **PROJECT STRUCTURE**

```
ARC-APPLICATION/
│
├── client/                          # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── BookingForm.js
│   │   │   ├── memberships/          # Membership components
│   │   │   └── ...
│   │   ├── App.js
│   │   ├── api.js                    # Axios client with JWT interceptor
│   │   ├── App.css
│   │   └── index.js
│   ├── package.json
│   └── README.md
│
├── server/                          # Node.js/Express Backend
│   ├── routes/
│   │   ├── api.js                   # Main booking API (2263 lines)
│   │   └── memberships.js           # Membership API (1596 lines)
│   ├── middleware/
│   │   └── auth.js                  # JWT & role validation
│   ├── database.js                  # MySQL pool connection
│   ├── server.js                    # Express app entry point
│   ├── sse.js                       # Server-Sent Events handler
│   ├── db.sql                       # Core database schema
│   ├── migrations.sql               # Payment table migration
│   ├── membership.sql               # Membership schema (14 tables total)
│   ├── package.json
│   └── .env
│
├── README.md                        # This file
├── POSTMAN_API_TESTING.md           # API testing guide
└── .gitignore
```

---

## 📊 **DATABASE STATISTICS**

- **Tables**: 14
- **Total Records Type**: Bookings, Memberships, Payments, Attendance
- **Key Relationships**: 20+ foreign keys
- **Constraints**: UNIQUE, NOT NULL, CHECK, DEFAULT
- **Indexes**: Auto on primary keys, compound unique on memberships

---

## 🔧 **AVAILABLE SCRIPTS**

### **Server**
```bash
npm start                     # Production mode
npm run dev                   # Development with nodemon
```

### **Client**
```bash
npm start                     # Dev server (port 3000)
npm test                      # Run tests
npm run build                 # Production build
npm run eject                 # Eject from Create React App
```

---

## ⚡ **PERFORMANCE FEATURES**

- **Connection Pooling**: 10 max connections with queue management
- **JWT Stateless Auth**: No server-side session storage
- **Indexed Queries**: Fast lookups on commonly searched fields
- **Real-time Updates**: SSE & Socket.io for instant notifications
- **Pagination**: Large datasd (10-50 items/page)
- **Caching**: localStorage for JWT & user data
- **Lazy Loading**: Components load only when needed

---

## 🤝 **CONTRIBUTING**

1. Create a feature branch: `git checkout -b feature/YourFeature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feature/YourFeature`
4. Open a Pull Request

---

## 📝 **LICENSE**

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## 📞 **SUPPORT**

For issues, feature requests, or questions:
1. Check existing GitHub issues
2. Create a detailed issue with steps to reproduce
3. Include your environment info (OS, Node version, MySQL version)

---

**Last Updated**: February 25, 2026  
**Version**: 1.0.0 Production
