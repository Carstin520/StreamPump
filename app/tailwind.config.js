/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx}", "./src/components/**/*.{js,ts,jsx,tsx}"],
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
