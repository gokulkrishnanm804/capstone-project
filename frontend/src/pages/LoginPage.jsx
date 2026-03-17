import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  CircularProgress,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { login as apiLogin } from "../api";
import { useAuth } from "../AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiLogin(form);
      const token = res.data.access_token;
      // Decode JWT payload to extract role
      const payload = JSON.parse(atob(token.split(".")[1]));
      loginUser(token, { username: payload.sub, role: payload.role });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 10 }}>
      <Paper elevation={6} sx={{ p: 5, borderRadius: 3, textAlign: "center" }}>
        <LockIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Access the Fraud Detection System
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Username"
            name="username"
            fullWidth
            required
            margin="normal"
            value={form.username}
            onChange={handleChange}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={form.password}
            onChange={handleChange}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2, py: 1.5, fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={24} /> : "Login"}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3 }}>
          Don't have an account?{" "}
          <RouterLink
            to="/register"
            style={{ color: "#1a237e", fontWeight: 600 }}
          >
            Register
          </RouterLink>
        </Typography>
      </Paper>
    </Container>
  );
}
