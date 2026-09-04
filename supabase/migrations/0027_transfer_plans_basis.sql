-- Temeiul transferului: ședință sau decizie.
--
-- Până acum orice planificare atârna de o ședință, iar transferul se făcea în
-- ultima zi programată dinaintea ei. Un transfer poate fi însă dispus și printr-o
-- decizie, iar atunci regula e răsturnată: se execută la prima zi programată DE
-- LA data parvenirii deciziei, nu înaintea vreunui termen.
--
-- Ziua de transfer nu se stochează nici acum — se calculează din temei și dată,
-- ca o amânare sau o decizie sosită târziu să mute însemnarea singură.

alter table transfer_plans
  add column if not exists basis text not null default 'sedinta',
  add column if not exists decision_date date;

-- Rândurile de dinainte sunt toate ședințe: `default` de mai sus le-a marcat
-- corect, deci constrângerea se poate pune fără curățenie prealabilă.
alter table transfer_plans drop constraint if exists transfer_plans_basis_check;
alter table transfer_plans add constraint transfer_plans_basis_check
  check (basis in ('sedinta', 'decizie'));

-- La decizie nu există ședință, deci data ședinței nu mai poate fi obligatorie
-- la nivel de coloană. Rămâne obligatorie pentru ședințe, prin constrângerea
-- de mai jos — acolo unde regula poate fi scrisă întreagă.
alter table transfer_plans alter column hearing_date drop not null;

-- Instanța devine opțională: o decizie poate veni și din altă parte decât de la
-- o judecătorie. La ședință rămâne obligatorie — o ședință fără instanță n-are
-- înțeles.
alter table transfer_plans alter column court drop not null;

-- O singură constrângere ține toată regula, ca o planificare pe jumătate
-- completată să nu poată exista deloc: nu „se validează în formular", ci nu
-- încape în tabel.
alter table transfer_plans drop constraint if exists transfer_plans_temei;
alter table transfer_plans add constraint transfer_plans_temei check (
  (
    basis = 'sedinta'
    and hearing_date is not null
    and decision_date is null
    and court is not null
  )
  or (
    basis = 'decizie'
    and decision_date is not null
    and hearing_date is null
  )
);

create index if not exists transfer_plans_decision_idx
  on transfer_plans (decision_date) where not done;
