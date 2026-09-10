-- Участник поездки — либо аккаунт, либо гость по имени, но не то и другое сразу
-- и не пустота. Prisma не умеет выражать это в схеме, поэтому проверка задаётся
-- напрямую: приложение и так это соблюдает, но гарантию даёт только база.
ALTER TABLE "TripMember"
  ADD CONSTRAINT "TripMember_identity_check"
  CHECK (("userId" IS NULL) <> ("guestName" IS NULL));
