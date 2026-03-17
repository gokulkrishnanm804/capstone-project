import { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Divider,
  Card,
  CardContent,
  MenuItem,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { predict, getFeatures } from "../api";

// Human-friendly labels for the raw PaySim numeric fields
const FRIENDLY_LABELS = {
  step: "Time Step (hours)",
  amount: "Transaction Amount",
  oldbalanceOrg: "Sender Old Balance",
  newbalanceOrig: "Sender New Balance",
  oldbalanceDest: "Receiver Old Balance",
  newbalanceDest: "Receiver New Balance",
  isFlaggedFraud: "Flagged Fraud (0/1)",
};

// Transaction types — the training script one-hot encodes these
const TRANSACTION_TYPES = [
  "CASH_IN",
  "CASH_OUT",
  "DEBIT",
  "PAYMENT",
  "TRANSFER",
];

export default function FraudDetectionPage() {
  const [featureColumns, setFeatureColumns] = useState([]);
  const [form, setForm] = useState({});
  const [txnType, setTxnType] = useState("TRANSFER");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [featuresLoading, setFeaturesLoading] = useState(true);

  // Separate type_* columns from raw numeric input fields
  const typeColumns = featureColumns.filter((f) => f.startsWith("type_"));
  const numericColumns = featureColumns.filter((f) => !f.startsWith("type_"));

  useEffect(() => {
    getFeatures()
      .then((res) => {
        const cols = res.data.features;
        setFeatureColumns(cols);
        const init = {};
        cols
          .filter((c) => !c.startsWith("type_"))
          .forEach((c) => (init[c] = ""));
        setForm(init);
      })
      .catch(() =>
        setError("Could not load model features. Is the backend running?"),
      )
      .finally(() => setFeaturesLoading(false));
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      // Build features dict: numeric fields + one-hot type columns
      const features = {};
      numericColumns.forEach((f) => (features[f] = parseFloat(form[f]) || 0));
      typeColumns.forEach((col) => {
        // col is like "type_TRANSFER" — set 1.0 if matches selected type
        features[col] = col === `type_${txnType}` ? 1.0 : 0.0;
      });
      const res = await predict({ features });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const init = {};
    numericColumns.forEach((c) => (init[c] = ""));
    setForm(init);
    setTxnType("TRANSFER");
    setResult(null);
    setError("");
  };

  if (featuresLoading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Typography
        variant="h4"
        fontWeight={700}
        gutterBottom
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <SecurityIcon color="primary" fontSize="large" /> Fraud Detection
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Enter transaction features below and click Analyze to detect fraud.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Transaction type selector */}
            {typeColumns.length > 0 && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="Transaction Type"
                  select
                  fullWidth
                  size="small"
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {/* Numeric input fields */}
            {numericColumns.map((field) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={field}>
                <TextField
                  label={FRIENDLY_LABELS[field] || field}
                  name={field}
                  type="number"
                  size="small"
                  fullWidth
                  value={form[field]}
                  onChange={handleChange}
                  inputProps={{ step: "any" }}
                />
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} /> : "Analyze Transaction"}
            </Button>
            <Button variant="outlined" size="large" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Box>
      </Paper>

      {result && <PredictionResult data={result} />}
    </Container>
  );
}

function PredictionResult({ data }) {
  const isFraud = data.prediction === "FRAUD";
  const chartData = (data.feature_importance || []).map((item) => ({
    name: item.feature,
    value: Math.abs(item.contribution),
    raw: item.contribution,
  }));

  return (
    <>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Prediction Result
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            elevation={4}
            sx={{
              borderRadius: 3,
              borderLeft: `6px solid ${isFraud ? "#d32f2f" : "#2e7d32"}`,
            }}
          >
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Prediction
              </Typography>
              <Chip
                label={data.prediction}
                color={isFraud ? "error" : "success"}
                sx={{ mt: 1, fontWeight: 700, fontSize: 18, px: 3, py: 2.5 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={4} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Final Fusion Score
              </Typography>
              <Typography
                variant="h4"
                fontWeight={700}
                color={isFraud ? "error" : "success.main"}
                sx={{ mt: 1 }}
              >
                {(data.final_score * 100).toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={4} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Model Scores
              </Typography>
              <Typography variant="body2">
                Random Forest:{" "}
                <strong>
                  {(data.random_forest_probability * 100).toFixed(2)}%
                </strong>
              </Typography>
              <Typography variant="body2">
                XGBoost:{" "}
                <strong>{(data.xgboost_probability * 100).toFixed(2)}%</strong>
              </Typography>
              <Typography variant="body2">
                Isolation Forest:{" "}
                <strong>
                  {(data.isolation_forest_score * 100).toFixed(2)}%
                </strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h5" fontWeight={700} gutterBottom>
        Explainable AI — Feature Importance (SHAP)
      </Typography>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={50} />
            <Tooltip formatter={(v) => v.toFixed(6)} />
            <Bar dataKey="value" name="SHAP Contribution">
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.raw >= 0 ? "#d32f2f" : "#2e7d32"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          Red = pushes toward fraud, Green = pushes toward normal. Top 10 most
          important features shown.
        </Typography>
      </Paper>
    </>
  );
}
