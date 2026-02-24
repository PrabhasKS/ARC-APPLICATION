# ARC SportsZone — Postman API Testing Guide

**Base URL:** `http://localhost:5000`

> [!IMPORTANT]
> Most endpoints require a JWT token. First call **Login**, then copy the `token` from the response. In Postman, go to the **Authorization** tab → Type: **Bearer Token** → paste the token.

---

## 1. Authentication

### 1.1 Login
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/login` |
| **Auth** | None |
| **Body Type** | JSON |

```json
{
    "username": "username",
    "password": "password"
}
```

**Expected Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 1, "username": "admin1", "role": "admin" }
}
```

> [!TIP]
> Save the `token` value. You will need it for **every** request below. In Postman, set it as a variable: `{{token}}`

---

## 2. User Management (Admin Only)

### 2.1 Create User
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/admin/users` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "username": "desk1",
    "password": "desk123",
    "role": "desk"
}
```
> Roles: `admin`, `desk`, `staff`

### 2.2 Get All Users
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/admin/users` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

### 2.3 Delete User
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/admin/users/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

> Replace `:id` with the user's ID, e.g. `/api/admin/users/3`

---

## 3. Sports

### 3.1 Get All Sports
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/sports` |
| **Auth** | Bearer Token |
| **Body** | None |

### 3.2 Add Sport (Admin)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/sports` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Cricket",
    "price": 500,
    "capacity": 1
}
```

### 3.3 Update Sport (Admin)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/sports/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "price": 350,
    "capacity": 1
}
```

### 3.4 Delete Sport (Admin)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/sports/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

---

## 4. Courts

### 4.1 Get All Courts
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/courts` |
| **Auth** | Bearer Token |
| **Body** | None |

### 4.2 Add Court (Admin)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/courts` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Badminton Court 3",
    "sport_id": 1
}
```

### 4.3 Update Court Status (Admin/Desk)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/courts/:id/status` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "status": "Under Maintenance"
}
```
> Allowed statuses: `Available`, `Under Maintenance`, `Event`, `Tournament`, `Membership`, `Coaching`

### 4.4 Delete Court (Admin)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/courts/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

### 4.5 Check Court Availability
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/courts/availability?date=2026-02-24&startTime=10:00 AM&endTime=11:00 AM` |
| **Auth** | Bearer Token |
| **Body** | None |

---

## 5. Bookings

### 5.1 Calculate Price
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/bookings/calculate-price` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "sport_id": 1,
    "startTime": "10:00",
    "endTime": "11:00",
    "slots_booked": 1,
    "discount_amount": 0,
    "accessories": []
}
```

### 5.2 Check Booking Clash
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/bookings/check-clash` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "court_id": 1,
    "date": "2026-02-24",
    "startTime": "10:00",
    "endTime": "11:00",
    "slots_booked": 1
}
```

### 5.3 Create Booking
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/bookings` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "court_id": 1,
    "customer_name": "Prabhas",
    "customer_contact": "9876543210",
    "customer_email": "prabhas@test.com",
    "date": "2026-02-25",
    "startTime": "10:00",
    "endTime": "11:00",
    "payment_mode": "cash",
    "payment_id": "",
    "amount_paid": 300,
    "slots_booked": 1,
    "discount_amount": 0,
    "discount_reason": "",
    "accessories": []
}
```

**With Accessories:**
```json
{
    "court_id": 1,
    "customer_name": "Prabhas",
    "customer_contact": "9876543210",
    "customer_email": "",
    "date": "2026-02-25",
    "startTime": "14:00",
    "endTime": "15:00",
    "payment_mode": "online",
    "payment_id": "TXN123456",
    "amount_paid": 200,
    "slots_booked": 1,
    "discount_amount": 50,
    "discount_reason": "Regular customer",
    "accessories": [
        { "accessory_id": 1, "quantity": 2 },
        { "accessory_id": 2, "quantity": 1 }
    ]
}
```

### 5.4 Get Bookings by Date
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/bookings?date=2026-02-24` |
| **Auth** | Bearer Token |
| **Body** | None |

### 5.5 Get All Bookings (Ledger with Pagination)
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/bookings/all?page=1&limit=10` |
| **Auth** | Bearer Token |
| **Body** | None |

**Optional Query Params:** `date`, `sport`, `customer`, `startTime`, `endTime`, `search`, `status` (active/closed/cancelled)

### 5.6 Get Active Bookings (Today)
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/bookings/active` |
| **Auth** | Bearer Token |
| **Body** | None |

### 5.7 Update Booking
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/bookings/:id` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "customer_name": "Prabhas Updated",
    "customer_contact": "9876543210",
    "date": "2026-02-26",
    "startTime": "11:00",
    "endTime": "12:00",
    "total_price": 300,
    "is_rescheduled": true,
    "discount_amount": 0,
    "discount_reason": "",
    "accessories": [],
    "stagedPayments": []
}
```

### 5.8 Extend Booking
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/bookings/:id/extend` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "extend_duration": 30
}
```
> Duration is in **minutes**.

### 5.9 Cancel Booking (Admin)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/bookings/:id/cancel` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

---

## 6. Payments

### 6.1 Add Payment to Booking
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/bookings/:id/payments` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "amount": 100,
    "payment_mode": "cash",
    "payment_id": ""
}
```

### 6.2 Update Payment Status (Legacy)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/bookings/:id/payment` |
| **Auth** | Bearer Token |
| **Body Type** | JSON |

```json
{
    "amount_paid": 300,
    "payment_status": "Completed"
}
```

---

## 7. Accessories

### 7.1 Get All Accessories
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/accessories` |
| **Auth** | Bearer Token |
| **Body** | None |

### 7.2 Add Accessory (Admin)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/accessories` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Tennis Ball",
    "price": 50
}
```

### 7.3 Update Accessory (Admin)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/accessories/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Tennis Ball (Premium)",
    "price": 75
}
```

### 7.4 Delete Accessory (Admin)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/accessories/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body** | None |

---

## 8. Availability Heatmap

### 8.1 Get Heatmap Data
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/availability/heatmap?date=2026-02-24` |
| **Auth** | Bearer Token |
| **Body** | None |

---

## 9. PDF Receipt

### 9.1 Download Booking Receipt
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/booking/:id/receipt.pdf` |
| **Auth** | None |
| **Body** | None |

> Opens/downloads a PDF. In Postman, click **"Send and Download"** to save the file.

---

## 10. Ledger Download

### 10.1 Download Ledger CSV
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/ledger/download` |
| **Auth** | Bearer Token |
| **Body** | None |

> Downloads a CSV file. Use **"Send and Download"** in Postman.

---

## 11. Analytics (Admin Only)

> All analytics endpoints accept optional query params: `?startDate=2026-02-01&endDate=2026-02-28`

### 11.1 Booking Summary
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/summary` |

### 11.2 Desk Summary
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/desk-summary?date=2026-02-24` |
| **Auth** | Bearer Token (Admin/Desk) |

### 11.3 Bookings Over Time
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/bookings-over-time` |

### 11.4 Revenue by Sport
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/revenue-by-sport` |

### 11.5 Utilization Heatmap
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/utilization-heatmap` |

### 11.6 Booking Status Distribution
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/booking-status-distribution` |

### 11.7 Revenue by Payment Mode
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/revenue-by-payment-mode` |

### 11.8 Staff Performance
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/staff-performance` |

### 11.9 Membership Summary
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/membership/summary` |

### 11.10 Membership Revenue by Sport
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/membership/revenue-by-sport` |

### 11.11 Membership Revenue by Payment Mode
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/membership/revenue-by-payment-mode` |

### 11.12 Overall Summary
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/overall/summary` |

### 11.13 Overall Revenue by Sport
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/overall/revenue-by-sport` |

### 11.14 Overall Revenue by Payment Mode
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/overall/revenue-by-payment-mode` |

### 11.15 Revenue Distribution (Bookings vs Memberships)
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/analytics/overall/revenue-distribution` |

---

## 12. SSE (Server-Sent Events)

### 12.1 Subscribe to Events
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/events` |
| **Auth** | None |

> This is a **streaming endpoint**. In Postman, the response will keep the connection open. Events like `bookings_updated` and `courts_updated` will stream in real-time.

---

## 13. Membership Packages (Admin Only)

### 13.1 Get All Packages
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/packages` |
| **Auth** | Bearer Token |

### 13.2 Get Package by ID
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/packages/:id` |
| **Auth** | Bearer Token |

### 13.3 Create Package (Admin)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/packages` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Monthly Badminton",
    "sport_id": 1,
    "duration_days": 30,
    "per_person_price": 2000,
    "max_team_size": 4,
    "details": "1 hour daily access"
}
```

### 13.4 Update Package (Admin)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/packages/:id` |
| **Auth** | Bearer Token (Admin) |
| **Body Type** | JSON |

```json
{
    "name": "Monthly Badminton Premium",
    "sport_id": 1,
    "duration_days": 30,
    "per_person_price": 2500,
    "max_team_size": 6,
    "details": "2 hours daily access"
}
```

### 13.5 Delete Package (Admin)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/memberships/packages/:id` |
| **Auth** | Bearer Token (Admin) |

---

## 14. Members

### 14.1 Create Member
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/members` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "full_name": "Rahul Sharma",
    "phone_number": "9876543210",
    "email": "rahul@test.com",
    "notes": "Regular player"
}
```

### 14.2 Search Members
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/members?q=Rahul` |
| **Auth** | Bearer Token (Admin/Desk) |

> Omit `q` param to get **all** members.

### 14.3 Update Member
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/members/:id` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "full_name": "Rahul K Sharma",
    "phone_number": "9876543210",
    "email": "rahul.updated@test.com",
    "notes": ""
}
```

### 14.4 Delete Member
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/memberships/members/:id` |
| **Auth** | Bearer Token (Admin/Desk) |

---

## 15. Membership Subscriptions

### 15.1 Check Membership Clash
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/check-clash` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "package_id": 1,
    "court_id": 1,
    "start_date": "2026-03-01",
    "time_slot": "6:00 AM - 7:00 AM"
}
```

### 15.2 Create Subscription
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/subscribe` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "package_id": 1,
    "court_id": 1,
    "start_date": "2026-03-01",
    "time_slot": "6:00 AM - 7:00 AM",
    "team_members": [
        { "member_id": 1 },
        { "member_id": 2 }
    ],
    "discount_amount": 0,
    "discount_details": "",
    "initial_payment": {
        "amount": 2000,
        "payment_mode": "cash",
        "payment_id": ""
    }
}
```

### 15.3 Get Active Memberships
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/active?date=2026-02-24` |
| **Auth** | Bearer Token (Admin/Desk) |

> `date` param is optional.

### 15.4 Get Terminated Memberships
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/terminated` |
| **Auth** | Bearer Token (Admin/Desk) |

### 15.5 Get Membership Details
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/:id/details` |
| **Auth** | Bearer Token (Admin/Desk) |

### 15.6 Renew Membership
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/active/:id/renew` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "start_date": "2026-04-01",
    "discount_details": "Loyalty discount",
    "new_member_ids": [1, 2],
    "initial_payment": {
        "amount": 1500,
        "payment_mode": "online",
        "payment_id": "TXN789"
    }
}
```

### 15.7 Terminate Ended Membership
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/ended/:id/terminate` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body** | None |

### 15.8 Add Member to Active Membership
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/active/:id/add-member` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "member_id": 3,
    "payment": {
        "amount": 2000,
        "payment_mode": "cash",
        "payment_id": ""
    }
}
```

### 15.9 Manage Members (Replace Team)
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/active/:id/manage-members` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "member_ids": [1, 2, 4]
}
```

---

## 16. Membership Payments

### 16.1 Add Payment to Membership
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/active/:id/payments` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "amount": 500,
    "payment_mode": "online",
    "payment_id": "TXN456"
}
```

---

## 17. Leave Management

### 17.1 Get Leave Requests
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/leave-requests` |
| **Auth** | Bearer Token (Admin/Desk) |

### 17.2 Request Leave (Legacy)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/request-leave` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "membership_id": 1,
    "leave_days": 3,
    "reason": "Out of town"
}
```

### 17.3 Grant Leave (Direct)
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/grant-leave` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "membership_id": 1,
    "start_date": "2026-03-10",
    "end_date": "2026-03-12",
    "reason": "Travelling"
}
```

### 17.4 Approve/Reject Leave Request
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `http://localhost:5000/api/memberships/leave-requests/:id` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "status": "APPROVED"
}
```
> Status: `APPROVED` or `REJECTED`

### 17.5 Get Memberships on Leave
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/on-leave?date=2026-02-24` |
| **Auth** | Bearer Token (Admin/Desk) |

### 17.6 Get Leave History for a Membership
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/active/:id/leave-history` |
| **Auth** | Bearer Token (Admin/Desk) |

---

## 18. Holidays

### 18.1 Get All Holidays
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/holidays` |
| **Auth** | Bearer Token (Admin/Desk) |

### 18.2 Declare Holiday
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/holidays` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "holiday_date": "2026-03-14",
    "reason": "Holi Festival"
}
```

### 18.3 Delete Holiday
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `http://localhost:5000/api/memberships/holidays/:id` |
| **Auth** | Bearer Token (Admin/Desk) |

---

## 19. Team Attendance

### 19.1 Mark Attendance
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `http://localhost:5000/api/memberships/team-attendance` |
| **Auth** | Bearer Token (Admin/Desk) |
| **Body Type** | JSON |

```json
{
    "membership_id": 1,
    "attendance_date": "2026-02-24"
}
```

### 19.2 Get Attendance for Date
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/team-attendance?date=2026-02-24` |
| **Auth** | Bearer Token (Admin/Desk) |

---

## 20. Membership PDF Receipt

### 20.1 Download Membership Receipt
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `http://localhost:5000/api/memberships/:id/receipt.pdf` |
| **Auth** | Bearer Token (Admin/Desk) |

> Use **"Send and Download"** in Postman.

---

## Recommended Testing Order

1. **Login** → Get token
2. **Get Sports** → Note sport IDs
3. **Get Courts** → Note court IDs
4. **Calculate Price** → Verify pricing logic
5. **Check Clash** → Ensure slot is free
6. **Create Booking** → Make a test booking
7. **Get Bookings** → Verify it appears
8. **Add Payment** → Test partial payment
9. **Update Booking** → Test edit flow
10. **Cancel Booking** → Test cancellation
11. **Analytics** → Verify numbers match
12. **Create Member** → For membership testing
13. **Create Package** → Set up a plan
14. **Subscribe** → Create a membership
15. **Grant Leave** → Test leave extension
16. **Mark Attendance** → Test attendance flow
