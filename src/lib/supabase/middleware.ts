import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ANTET_SESIUNE } from "@/lib/session-header";

/** Un cookie pe care Supabase vrea să-l trimită înapoi browserului. */
interface CookieDeTrimis {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function updateSession(request: NextRequest) {
  /**
   * Cookie-urile pe care Supabase le cere la reîmprospătarea sesiunii se strâng
   * aici și se pun pe răspuns o singură dată, la sfârșit.
   *
   * Înainte se construia câte un răspuns nou la fiecare `setAll`, iar la capăt
   * se returna ultimul. Mergea, dar nu mai merge de când răspunsul trebuie să
   * poarte și un antet care se știe abia după `getUser()`: ar fi însemnat să
   * mutăm cookie-uri de sesiune dintr-un răspuns în altul, adică fix locul unde
   * o scăpare îi deconectează pe toți fără să se vadă în teste.
   *
   * Strânse într-o listă, ele se scriu o dată, pe singurul răspuns care pleacă.
   */
  const deTrimis: CookieDeTrimis[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieDeTrimis[]) {
          // Pe cererea trimisă mai departe, ca randarea paginii să vadă
          // sesiunea proaspătă, nu pe cea de dinainte de reîmprospătare.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          deTrimis.push(...cookiesToSet);
        },
      },
    },
  );

  // IMPORTANT: getUser() must be called to refresh the session.
  //
  // Cronometrat fiindcă e singurul drum prin rețea făcut aici, iar durata lui
  // pleacă mai jos într-un antet `Server-Timing`: din browser se vede atunci
  // cât din așteptare e verificarea sesiunii și cât e restul.
  const inceputAuth = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const durataAuth = Date.now() - inceputAuth;

  const { pathname } = request.nextUrl;
  /**
   * `/api/backup` e chemată de Vercel Cron, care trimite secretul într-un antet
   * și **niciun cookie**. Fără excepția asta, cererea e redirecționată la
   * `/login` înainte să ajungă la rută, iar copia de siguranță nu rulează
   * niciodată — tăcut, fiindcă un 307 nu e o eroare pentru nimeni.
   *
   * Ruta se apără singură, comparând `CRON_SECRET`, și refuză să pornească dacă
   * secretul nu e configurat. Excepția e scrisă pe cale exactă, nu pe `/api`:
   * altfel orice rută API adăugată mai târziu ar deveni publică din neatenție.
   */
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/api/backup";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectionare = NextResponse.redirect(url);
    // Și pe drumul acesta: dacă sesiunea tocmai s-a reîmprospătat, cookie-urile
    // ei trebuie să ajungă la browser, altfel munca lui `getUser()` se pierde.
    deTrimis.forEach(({ name, value, options }) =>
      redirectionare.cookies.set(name, value, options),
    );
    redirectionare.headers.set("Server-Timing", timing(durataAuth));
    return redirectionare;
  }

  /**
   * Un indiciu pentru layout: are cererea o sesiune sau nu.
   *
   * Doar de desen. Layout-ul îl citește ca să știe dacă rezervă locul barei de
   * sus înainte de a afla cine e conectat — altfel pagina de autentificare ar
   * arăta o clipă o bară care apoi dispare. Nicio identitate nu trece prin el;
   * cine e omul se află tot din Supabase, în componenta barei.
   *
   * Se scrie MEREU, și pe „0”. Așa, un antet cu același nume venit din afară nu
   * poate supraviețui: e suprascris la fiecare cerere.
   */
  const antete = new Headers(request.headers);
  antete.set(ANTET_SESIUNE, user ? "1" : "0");

  const raspuns = NextResponse.next({ request: { headers: antete } });
  deTrimis.forEach(({ name, value, options }) => raspuns.cookies.set(name, value, options));
  raspuns.headers.set("Server-Timing", timing(durataAuth));
  return raspuns;
}

/**
 * Cât a durat verificarea sesiunii, într-o formă pe care browserul o înțelege.
 *
 * Se citește în Chrome la Inspectare → Network → cererea paginii → Timing, unde
 * apare lângă timpul total. Fără ea, din afară se vede doar o singură cifră —
 * „a durat 400 ms" — fără să se știe cât din ea e autentificarea, cât sunt
 * datele și cât pornirea funcției.
 *
 * Nu e o scurgere: spune o durată, nu cine e omul.
 */
function timing(durataAuth: number): string {
  return `auth;dur=${durataAuth};desc="verificare sesiune"`;
}
