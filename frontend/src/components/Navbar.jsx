import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import SecurityIcon from "@mui/icons-material/Security";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import { useAuth } from "../AuthContext";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: <HomeIcon /> },
  {
    label: "Fraud Detection",
    path: "/detect",
    icon: <SecurityIcon />,
    auth: true,
  },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <DashboardIcon />,
    auth: true,
  },
  {
    label: "Admin",
    path: "/admin",
    icon: <AdminPanelSettingsIcon />,
    auth: true,
    role: "admin",
  },
];

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.auth && !isAuthenticated) return false;
    if (item.role && user?.role !== item.role) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const drawer = (
    <Box sx={{ width: 250 }} onClick={() => setDrawerOpen(false)}>
      <List>
        {visibleItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton component={RouterLink} to={item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
        {isAuthenticated ? (
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        ) : (
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/login">
              <ListItemIcon>
                <LoginIcon />
              </ListItemIcon>
              <ListItemText primary="Login" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        sx={{ background: "linear-gradient(90deg, #1a237e 0%, #0d47a1 100%)" }}
      >
        <Toolbar>
          <SecurityIcon sx={{ mr: 1 }} />
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 1 }}
          >
            FraudShield AI
          </Typography>

          {isMobile ? (
            <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          ) : (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {visibleItems.map((item) => (
                <Button
                  key={item.path}
                  color="inherit"
                  component={RouterLink}
                  to={item.path}
                  startIcon={item.icon}
                >
                  {item.label}
                </Button>
              ))}
              {isAuthenticated ? (
                <Button
                  color="inherit"
                  onClick={handleLogout}
                  startIcon={<LogoutIcon />}
                >
                  Logout
                </Button>
              ) : (
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/login"
                  startIcon={<LoginIcon />}
                >
                  Login
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawer}
      </Drawer>
    </>
  );
}
