/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/components/auth/**/*.{js,ts,jsx,tsx}",
    "./src/components/layout/AppShell.tsx",
    "./src/components/post/**/*.{js,ts,jsx,tsx}",
    "./src/components/shared/**/*.{js,ts,jsx,tsx}",
    "./src/components/user/**/*.{js,ts,jsx,tsx}",
    "./src/components/workspace/**/*.{js,ts,jsx,tsx}",
    "!./src/**/* 2.ts",
    "!./src/**/* 2.tsx",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0D1321",
        surf: "#E8F1F2",
        accent: "#0070F3",
        heat: "#F95738"
      }
    },
  },
  plugins: [],
};
