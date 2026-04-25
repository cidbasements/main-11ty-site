/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{njk,md,html,js}"],
  theme: {
    extend: {
      colors: {
        gold: "#f2b71d",
        green: "#324c31",
        "dark-gray": "#626262",
        gray: "#efedee",
        "off-white": "#ebebeb",
      },
      fontFamily: {
        serif: ["Maitree", "Palatino Linotype", "Palatino", "Book Antiqua", "Georgia", "serif"],
        heading: ["Palanquin Dark", "sans-serif"],
      },
      maxWidth: {
        "site": "1280px",
      },
      spacing: {
        "layout": "2.6vw",
      },
    },
  },
  plugins: [],
};
