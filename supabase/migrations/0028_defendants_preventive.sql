-- Măsura preventivă, ca să se poată ține evidența ambelor categorii.
--
-- Registrul avea o singură categorie de oameni aflați în grijă: „inculpați".
-- În fapt sunt două, deosebite prin măsura preventivă — unii o au, alții nu.
--
-- Se scrie măsura, nu categoria. „Prevenit" se citește din ea, deci cele două
-- nu se pot contrazice: o categorie ținută separat ar fi trebuit actualizată de
-- mână la fiecare schimbare a măsurii, iar prima dată când cineva ar fi uitat,
-- registrul ar fi spus două lucruri deodată despre același om.

alter table defendants
  add column if not exists preventive_measure boolean not null default false,
  add column if not exists preventive_measure_on date;

-- Data se poate lăsa goală: măsura poate fi știută fără ca data ei să fie la
-- îndemână în clipa înregistrării. Invers însă n-are înțeles — o dată a unei
-- măsuri care nu există ar fi o afirmație despre nimic.
alter table defendants drop constraint if exists defendants_preventive;
alter table defendants add constraint defendants_preventive
  check (preventive_measure or preventive_measure_on is null);

-- Rândurile de până acum rămân cu `false`: nimeni nu poate spune în locul
-- utilizatorului cine avea măsură preventivă, iar o ghicire ar intra tăcut în
-- registru. Se completează pe măsură ce sunt deschise.
create index if not exists defendants_preventive_idx
  on defendants (preventive_measure) where status = 'inculpat';
