/**
 * Numele indiciului de sesiune pe care middleware-ul îl pune pe cerere, iar
 * layout-ul îl citește.
 *
 * Stă singur, într-un fișier al lui, ca layout-ul să nu fie nevoit să importe
 * modulul middleware-ului — cu el ar veni `@supabase/ssr` și `next/server` în
 * graful paginilor, pentru un singur șir de caractere.
 *
 * E doar de desen: spune dacă se rezervă locul barei de sus înainte de a se ști
 * cine e conectat. Nicio identitate nu trece prin el, iar cine e omul se află
 * tot din Supabase. Middleware-ul îl scrie la fiecare cerere, și pe „0", deci
 * un antet cu același nume venit din afară nu poate supraviețui.
 */
export const ANTET_SESIUNE = "x-are-sesiune";
