# FraudShield AI — Frontend

React-based frontend for the Explainable AI Driven Secure Multi-Model Financial Fraud Detection System.

## Tech Stack

- React 19 + Vite
- React Router DOM
- Material UI (MUI)
- Axios
- Recharts

## Pages

| Route        | Page                | Auth Required |
| ------------ | ------------------- | ------------- |
| `/`          | Home                | No            |
| `/login`     | Login               | No            |
| `/register`  | Register            | No            |
| `/detect`    | Fraud Detection     | Yes           |
| `/dashboard` | Transaction History | Yes           |
| `/admin`     | Admin Analytics     | Yes (admin)   |

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` by default.

## Build

```bash
npm run build
```

Output is in the `dist/` folder.
