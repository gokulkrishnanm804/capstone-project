import { Link as RouterLink } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import PsychologyIcon from "@mui/icons-material/Psychology";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShieldIcon from "@mui/icons-material/Shield";
import { useAuth } from "../AuthContext";

const FEATURES = [
  {
    icon: <PsychologyIcon sx={{ fontSize: 48, color: "#1a237e" }} />,
    title: "Multi-Model AI",
    desc: "Combines Random Forest, XGBoost, and Isolation Forest for robust fraud detection.",
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 48, color: "#0d47a1" }} />,
    title: "Explainable AI",
    desc: "SHAP-based feature importance explains every prediction transparently.",
  },
  {
    icon: <ShieldIcon sx={{ fontSize: 48, color: "#1b5e20" }} />,
    title: "Secure Access",
    desc: "JWT authentication ensures only authorized users access the system.",
  },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <Box>
      {/* Hero */}
      <Paper
        sx={{
          py: 10,
          textAlign: "center",
          background:
            "linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%)",
          color: "#fff",
          borderRadius: 0,
        }}
        elevation={0}
      >
        <Container maxWidth="md">
          <SecurityIcon sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h3" fontWeight={800} gutterBottom>
            FraudShield AI
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>
            Explainable AI Driven Secure Multi-Model System for Financial Fraud
            Detection
          </Typography>
          {isAuthenticated ? (
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/detect"
              sx={{
                fontWeight: 700,
                px: 5,
                py: 1.5,
                backgroundColor: "#fff",
                color: "#1a237e",
                "&:hover": { backgroundColor: "#e3f2fd" },
              }}
            >
              Start Analyzing
            </Button>
          ) : (
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="contained"
                size="large"
                component={RouterLink}
                to="/login"
                sx={{
                  fontWeight: 700,
                  px: 4,
                  py: 1.5,
                  backgroundColor: "#fff",
                  color: "#1a237e",
                  "&:hover": { backgroundColor: "#e3f2fd" },
                }}
              >
                Sign In
              </Button>
              <Button
                variant="outlined"
                size="large"
                component={RouterLink}
                to="/register"
                sx={{
                  fontWeight: 700,
                  px: 4,
                  py: 1.5,
                  borderColor: "#fff",
                  color: "#fff",
                  "&:hover": {
                    borderColor: "#e3f2fd",
                    backgroundColor: "rgba(255,255,255,0.1)",
                  },
                }}
              >
                Register
              </Button>
            </Box>
          )}
        </Container>
      </Paper>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          textAlign="center"
          gutterBottom
        >
          Key Features
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          mb={5}
        >
          A state-of-the-art fraud detection pipeline powered by multiple
          machine learning models.
        </Typography>
        <Grid container spacing={4}>
          {FEATURES.map((f) => (
            <Grid size={{ xs: 12, md: 4 }} key={f.title}>
              <Card
                elevation={4}
                sx={{
                  borderRadius: 3,
                  textAlign: "center",
                  p: 3,
                  height: "100%",
                }}
              >
                <CardContent>
                  {f.icon}
                  <Typography variant="h6" fontWeight={700} mt={2} gutterBottom>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
