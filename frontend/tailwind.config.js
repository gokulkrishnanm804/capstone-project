/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070f",
        storm: "#0b1025",
        aurora: "#4fd1ff",
        pulse: "#8a7dff",
        mint: "#32d7a6",
        danger: "#ff5c8a",
      },
      boxShadow: {
        glass: "0 8px 35px rgba(30, 60, 130, 0.35)",
        neon: "0 0 0 1px rgba(79, 209, 255, 0.35), 0 0 35px rgba(79, 209, 255, 0.25)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 18% 12%, rgba(79,209,255,0.15), transparent 35%), radial-gradient(circle at 78% 20%, rgba(138,125,255,0.22), transparent 38%), radial-gradient(circle at 48% 78%, rgba(50,215,166,0.16), transparent 35%)",
      },
      fontFamily: {
        display: ["Sora", "Segoe UI", "sans-serif"],
        body: ["Space Grotesk", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
