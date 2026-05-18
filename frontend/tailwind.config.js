/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        teal: {
          500: "#14b8a6",
          600: "#0d9488",
        },
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.1rem" },
      boxShadow: { card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)" },
    },
  },
  plugins: [],
};
