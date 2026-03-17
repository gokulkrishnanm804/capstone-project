You are an expert full-stack developer, UI/UX designer, and AI engineer.

Build a COMPLETE production-style web application:

"FraudGuard AI – Simulation-Based Explainable Multi-Model Fraud Detection System"

The system must simulate real-world banking transactions instead of exposing raw dataset fields.

================================
🔷 CORE IDEA (VERY IMPORTANT)
=============================

DO NOT show dataset features like V1–V28 to users.

Instead:

- Preload dataset internally
- Simulate real banking accounts
- Users perform transactions between accounts
- Backend maps transaction → ML features → fraud prediction

================================
🔷 TECH STACK
=============

Frontend:
React + Vite
TailwindCSS
Framer Motion (animations)
Recharts (charts)

Backend:
FastAPI (Python)

Database:
MySQL

ML Models:
XGBoost
Random Forest
Isolation Forest

Explainable AI:
SHAP

================================
🔷 UI DESIGN (VERY IMPORTANT)
=============================

Design a premium fintech UI:

- Dark gradient background (navy → purple)
- Glassmorphism cards
- Neon accents (blue/purple glow)
- Smooth hover animations
- Rounded UI components
- Modern dashboard layout

Use Framer Motion for transitions.

================================
🔷 SIMULATION FEATURES
======================

Create a banking simulation system:

1. Predefined Accounts

Each user has:

- Account Number
- Account Balance
- Transaction History

2. Transaction Simulation

User selects:

- Sender Account (auto-filled)
- Receiver Account (dropdown)
- Amount
- Transaction Type (UPI / Card / Transfer)
- Location (optional dropdown)
- Device Type (Mobile/Desktop)

3. Simulated Fraud Scenarios

Generate fraud patterns:

- High amount transactions
- Rapid multiple transfers
- Unusual location
- New device usage
- Night-time transactions

Map these inputs internally to dataset features.

================================
🔷 FRONTEND PAGES
=================

1️⃣ Home Page

- Hero section
- “Start Simulation” button
- Animated fraud detection visualization
- System features

---

2️⃣ Login / Register

Register fields:

- Name
- Email
- Password
- Role (User/Admin)

Login:

- Email
- Password

Use JWT authentication.

---

3️⃣ User Dashboard

Show:

- Account balance
- Recent transactions
- Fraud detection stats
- Risk score meter

---

4️⃣ Transaction Simulation Page (MAIN FEATURE)

Form fields:

- From Account (auto)
- To Account (dropdown)
- Amount (input)
- Transaction Type
- Location
- Device

Buttons:

- Send Money
- Simulate Fraud

UI:

- Animated transaction flow
- Loading animation during prediction

---

5️⃣ Prediction Result Page

Display:

- Fraud / Safe (badge)

- Fraud Probability

- Model Scores:

  Random Forest
  XGBoost
  Isolation Forest

- Final Fusion Score

Add:

- Risk Meter (Low / Medium / High)
- SHAP explanation chart

---

6️⃣ Transaction History Page

Table:

- Date
- Amount
- Receiver
- Result
- Risk score

Filters:

- Fraud only
- Date range

---

7️⃣ Admin Dashboard

Show:

- Total users
- Total transactions
- Fraud detected
- Fraud percentage

Charts:

- Fraud trend
- Transaction volume
- Risk distribution

---

8️⃣ Model Insight Page (VERY IMPORTANT)

Explain:

- Multi-model system
- Supervised vs Unsupervised
- Fusion layer logic
- SHAP explanations

================================
🔷 BACKEND LOGIC
================

1. Load dataset internally

2. Train models:

- Random Forest
- XGBoost
- Isolation Forest

3. Mapping Logic

Convert transaction simulation inputs into ML feature vector.

4. Prediction Flow

- Supervised probability
- Unsupervised anomaly score
- Fusion calculation

Final Score =
0.4 RF + 0.4 XGB + 0.2 ISO

5. Store all transactions in database.

================================
🔷 FRAUD SIMULATION LOGIC
=========================

Create realistic fraud rules:

- Amount > threshold → higher risk
- New location → anomaly
- Multiple quick transactions → suspicious
- Night time → risky

================================
🔷 ANIMATIONS (IMPORTANT)
=========================

Use Framer Motion:

- Page transitions
- Card hover effects
- Button glow effects
- Loading spinners
- Smooth navigation

================================
🔷 OUTPUT REQUIREMENTS
======================

Provide FULL working project:

- React frontend
- FastAPI backend
- ML training code
- API integration
- Authentication system
- Simulation logic
- Charts and animations

Ensure project runs in VS Code with instructions.

Make the UI look like a real fintech product, not a student project.

🎯 Extra Simulation Ideas (Add if You Want)

You can add:

💳 Card Swipe Simulation

Swipe animation

POS machine UI

📱 UPI Payment Simulation

QR code scan UI

Payment success/failure animation

🌍 Location-Based Fraud

Map showing transaction location

⚠️ Fraud Alert Popup

“Suspicious Activity Detected”

📊 Risk Meter UI
LOW 🟢
MEDIUM 🟡
HIGH 🔴
🔥 Final Result

Your project will look like:

✅ Real banking system
✅ Not a basic ML demo
✅ Professional UI
✅ Strong academic value
✅ High chances to impress
