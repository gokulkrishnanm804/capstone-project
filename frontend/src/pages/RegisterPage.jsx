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
  MenuItem,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { register as apiRegister } from "../api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "user",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRegister(form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 10 }}>
      <Paper elevation={6} sx={{ p: 5, borderRadius: 3, textAlign: "center" }}>
        <PersonAddIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Register to access the system
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
            inputProps={{ minLength: 3, maxLength: 50 }}
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
            inputProps={{ minLength: 6, maxLength: 128 }}
          />
          <TextField
            label="Role"
            name="role"
            select
            fullWidth
            margin="normal"
            value={form.role}
            onChange={handleChange}
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2, py: 1.5, fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={24} /> : "Register"}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3 }}>
          Already have an account?{" "}
          <RouterLink to="/login" style={{ color: "#1a237e", fontWeight: 600 }}>
            Sign In
          </RouterLink>
        </Typography>
      </Paper>
    </Container>
  );
}
