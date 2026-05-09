/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                primary: '#002855', // Deep Blue
                secondary: '#D4AF37', // Gold
                tertiary: '#A08426', // Bronze
                accent: '#E5E7EB', // Light Grey
            },
            fontFamily: {
                sans: ['IBM Plex Sans', 'sans-serif'],
                serif: ['Merriweather', 'serif'],
            },
        },
    },
    plugins: [],
}
