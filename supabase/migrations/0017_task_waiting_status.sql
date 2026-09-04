-- Stare nouă „în așteptare": intervalul în care sarcina depinde de instanță sau
-- de un organ de stat, nu de responsabil. Cât e acolo, termenul nu o face
-- restantă — dar `waiting_since` ține minte de când, ca așteptările lungi să
-- rămână vizibile în loc să dispară liniștit.

-- `status` e enum (task_status), nu text cu check ca la petiții. Valoarea se
-- adaugă înaintea lui „done", ca ordinea tipului să urmeze fluxul lucrului.
-- Se rulează separat: o valoare de enum nu poate fi folosită în aceeași
-- tranzacție în care a fost adăugată.
alter type task_status add value if not exists 'waiting' before 'done';

alter table tasks add column if not exists waiting_since timestamptz;
