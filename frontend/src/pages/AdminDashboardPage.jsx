import { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Box,
  Paper,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PercentIcon from "@mui/icons-material/Percent";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getFraudAnalytics } from "../api";

const PIE_COLORS = ["#2e7d32", "#d32f2f"];

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getFraudAnalytics()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load analytics"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  if (!data) return null;

  const pieData = [
    { name: "Normal", value: data.total_transactions - data.fraud_detected },
    { name: "Fraud", value: data.fraud_detected },
  ];

  const barData = (data.chart_data || []).map((d, i) => ({
    name: d.label || `Txn ${i + 1}`,
    fraud: d.fraud,
    normal: d.normal,
  }));

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Typography
        variant="h4"
        fontWeight={700}
        gutterBottom
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <AdminPanelSettingsIcon color="primary" fontSize="large" /> Admin
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        System-wide fraud analytics and insights.
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            elevation={4}
            sx={{ borderRadius: 3, borderTop: "4px solid #1a237e" }}
          >
            <CardContent sx={{ textAlign: "center" }}>
              <ReceiptLongIcon sx={{ fontSize: 40, color: "#1a237e" }} />
              <Typography variant="h3" fontWeight={700}>
                {data.total_transactions}
              </Typography>
              <Typography color="text.secondary">Total Transactions</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            elevation={4}
            sx={{ borderRadius: 3, borderTop: "4px solid #d32f2f" }}
          >
            <CardContent sx={{ textAlign: "center" }}>
              <ReportProblemIcon sx={{ fontSize: 40, color: "#d32f2f" }} />
              <Typography variant="h3" fontWeight={700} color="error">
                {data.fraud_detected}
              </Typography>
              <Typography color="text.secondary">Fraud Detected</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            elevation={4}
            sx={{ borderRadius: 3, borderTop: "4px solid #f57c00" }}
          >
            <CardContent sx={{ textAlign: "center" }}>
              <PercentIcon sx={{ fontSize: 40, color: "#f57c00" }} />
              <Typography
                variant="h3"
                fontWeight={700}
                sx={{ color: "#f57c00" }}
              >
                {data.fraud_percentage.toFixed(2)}%
              </Typography>
              <Typography color="text.secondary">Fraud Percentage</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Fraud vs Normal
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Recent Transactions
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="normal" fill="#2e7d32" name="Normal" />
                <Bar dataKey="fraud" fill="#d32f2f" name="Fraud" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
