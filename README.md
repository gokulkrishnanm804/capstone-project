# FraudGuard AI

Simulation-Based Explainable Multi-Model Fraud Detection System.

This project now runs as a simulation-first banking platform:

- Users perform realistic account-to-account transactions.
- Backend converts simulation inputs into model feature vectors internally.
- UI never exposes raw ML dataset columns like V1-V28.

## Stack

- Frontend: React 19, Vite, TailwindCSS, Framer Motion, Recharts, Axios
- Backend: FastAPI, Pydantic v2, SQLAlchemy, JWT auth
- Database: MySQL
- Models: Random Forest, XGBoost, Isolation Forest
- Explainability: SHAP

## Core Fusion Logic

final_score = 0.4 _ RF + 0.4 _ XGB + 0.2 \* ISO

Prediction:

- FRAUD when score >= 0.5
- SAFE when score < 0.5

## Backend Setup

1. Create MySQL database:

   CREATE DATABASE fraudguard_ai;

2. Configure backend environment:
   - Copy backend/.env.example to backend/.env
   - Update DATABASE_URL and SECRET_KEY

3. Install dependencies:

   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt

4. Place dataset:

   Put creditcard.csv into backend/data/creditcard.csv

5. Train models:

   cd backend
   python train_models.py

6. Run API:

   cd backend
   uvicorn app.main:app --reload

API docs: http://localhost:8000/docs

## Frontend Setup

cd frontend
npm install
npm run dev

Frontend URL: http://localhost:5173

## Default Admin

- Email: admin@fraudguard.ai
- Password: Admin@123

## Main Frontend Routes

- / : Home
- /login : Login
- /register : Register
- /dashboard : User dashboard
- /simulate : Transaction simulation
- /result : Prediction result
- /history : Transaction history with filters
- /admin : Admin dashboard (admin only)
- /model-insight : Model architecture and SHAP insight page

## Main Backend Endpoints

- POST /register
- POST /login
- GET /me
- GET /simulation/context
- POST /simulation/transaction
- GET /transactions
- GET /fraud-analytics
- GET /model-insights

## Notes

- Database tables are auto-created on backend startup.
- Seed data includes a default admin account and external receiver accounts.
- Simulation mode supports send and simulate actions from the same form.
