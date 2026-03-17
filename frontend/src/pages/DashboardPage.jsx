import { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Box,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { getTransactions } from "../api";

export default function DashboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTransactions()
      .then((res) => setRows(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load transactions"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
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
        <DashboardIcon color="primary" fontSize="large" /> Transaction History
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Recent predictions submitted to the system.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#1a237e" }}>
            <TableRow>
              {[
                "#",
                "Transaction ID",
                "User",
                "RF Prob",
                "XGB Prob",
                "ISO Score",
                "Final Score",
                "Prediction",
                "Timestamp",
              ].map((h) => (
                <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No transactions yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={row.transaction_id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {row.transaction_id.slice(0, 12)}…
                  </TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>
                    {(row.fraud_probability * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    {(row.xgb_probability * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    {(row.isolation_score * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell>{(row.final_score * 100).toFixed(2)}%</TableCell>
                  <TableCell>
                    <Chip
                      label={row.prediction}
                      color={row.prediction === "FRAUD" ? "error" : "success"}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {new Date(row.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
