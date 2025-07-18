import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Adjunk hozzá egy 'server' részt a konfigurációhoz
  server: {
    // A 'proxy' objektum kezeli az átirányításokat
    proxy: {
      '/api': { // Ha a frontend egy URL-t kér, ami '/api'-val kezdődik (pl. /api/initialize_session)
        target: 'http://localhost:5000', // <-- Ide mutasson: a Flask backend címe és portja
        changeOrigin: true, // Fontos: módosítja a kérés 'Host' fejlécét a cél URL-re (szükséges lehet a backend számára)
        secure: false,      // Csak fejlesztéshez: ha a backend nem használ HTTPS-t (mint a debug módú Flask)
        // Ha a Flask útvonala CSAK `/initialize_session` lenne (nem `/api/initialize_session`),
        // akkor ezt a sort is be kellene kapcsolni:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    // Opcionális: Explicit módon beállíthatod, hogy a Vite a 5173-as porton fusson (ez az alapértelmezett, de így egyértelműbb)
    port: 5173,
  },
})
