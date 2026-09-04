-- De când ține evidența fiecare obligație.
--
-- Fără ea, o obligație înscrisă azi arată drept restant termenul de luna
-- trecută — o restanță inventată, dinainte ca evidența să existe. Alternativa
-- ar fi fost bifarea lunii trecute, dar bifa înseamnă „expediat", nu „nu ne
-- uităm acolo": ar fi fost o afirmație falsă scrisă în registru.
--
-- Implicit e ziua înscrierii: o obligație adăugată în octombrie nu întreabă
-- retroactiv de septembrie. Coloana e explicită, nu dedusă din `created_at`, ca
-- o restaurare din copie să nu mute istoria.

alter table obligations
  add column if not exists starts_on date not null default current_date;

-- Cele patru de acum încep cu august 2026, nu cu luna în care s-a rulat
-- migrarea: evidența pornește de la începutul lunii curente.
update obligations set starts_on = '2026-08-01' where starts_on > '2026-08-01';
