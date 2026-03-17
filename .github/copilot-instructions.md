# FraudShield AI — Copilot Instructions

## Project Overview

Explainable AI Driven Secure Multi-Model System for Financial Fraud Detection.

## Stack

- **Frontend**: React 19 + Vite, Material UI, Recharts, Axios, React Router DOM
- **Backend**: FastAPI (Python), Pydantic v2, JWT auth (python-jose), passlib+bcrypt
- **ML Models**: Random Forest, XGBoost, Isolation Forest (scikit-learn, xgboost)
- **Explainability**: SHAP (TreeExplainer)
- **Dataset**: creditcard.csv (Kaggle Credit Card Fraud Detection)

## Key Commands

### Backend

```bash
cd backend
.\venv\Scripts\activate
python train_models.py        # Train models (requires creditcard.csv in data/)
uvicorn app.main:app --reload # Start API server on :8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # Start dev server on :5173
npm run build # Production build
```

## Conventions

- Backend models saved as .pkl in backend/models/
- JSON-based storage for users and transactions in backend/data/
- JWT tokens expire after 60 minutes
- Default admin: username=admin, password=Admin@123
- Fusion formula: 0.4*RF + 0.4*XGB + 0.2\*ISO, threshold=0.5

## Setup Checklist

- [x] Verify copilot-instructions.md exists
- [x] Clarify project requirements
- [x] Scaffold the project
- [x] Customize the project (full frontend + backend)
- [x] Install required extensions (none needed)
- [x] Compile the project (frontend builds, backend imports clean)
- [x] Documentation complete (README.md + copilot-instructions.md)
  - User is provided with clear instructions to debug/launch the project

Before starting a new task in the above plan, update progress in the plan.
-->

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
