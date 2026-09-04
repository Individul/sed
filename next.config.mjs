/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite backup-uri mai mari la restaurare (upload prin server action).
    serverActions: {
      bodySizeLimit: "10mb",
    },

    /**
     * Fonturile pentru PDF, cărate explicit în funcția care le citește.
     *
     * `/raport-saptamanal/pdf` deschide `src/fonts/*.ttf` cu `fs` la fiecare
     * cerere, iar în funcția serverless ajung doar fișierele pe care Next le
     * *urmărește*. Fișierele citite la rulare nu se văd în niciun import, deci
     * regula generală e că nu ajung — local merge oricum, fiindcă acolo repo-ul
     * întreg e pe disc, exact felul de defect care trece de tot ce poți încerca
     * de pe calculatorul tău și cade la prima descărcare din producție.
     *
     * Măsurat, nu presupus: ștergând intrarea asta și reconstruind, fonturile
     * *tot* apar în trace — analizorul lui Next reușește azi să evalueze
     * `path.join(process.cwd(), "src", "fonts")` și numele scrise alături. Deci
     * intrarea nu repară nimic acum; e o ancoră. Norocul ăla ține de o
     * euristică pe cod: o refactorizare care compune numele fișierului dintr-o
     * variabilă îl orbește, iar pierderea n-ar da nicio eroare la build —
     * doar butonul „Descarcă PDF" ar începe să întoarcă 500 în producție.
     *
     * Calea e relativă la rădăcina proiectului, iar fișierele își păstrează
     * poziția în funcție — de aceea ruta le caută tot sub `process.cwd()`.
     *
     * Verificabil înainte de deploy: după `npm run build`, ambele `.ttf` trebuie
     * să fie în `.next/server/app/raport-saptamanal/pdf/route.js.nft.json`,
     * lista după care Vercel împachetează funcția.
     */
    outputFileTracingIncludes: {
      "/raport-saptamanal/pdf": ["./src/fonts/*.ttf"],
    },
  },
};
export default nextConfig;
