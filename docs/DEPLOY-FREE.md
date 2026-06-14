# Nasazení PodBrief úplně zdarma ($0/měsíc)

Celý PodBrief jde provozovat na free tierech. Trik je ve dvou věcech:

1. **Worker neběží pořád** — místo placeného kontejneru ho spouští **GitHub
   Actions** každých 30 min (stáhne nové epizody, zpracuje frontu, skončí).
2. **Sumarizace běží na Groqu zdarma** (Llama) místo placeného Anthropicu —
   přepínač `LLM_PROVIDER=groq`. (Kvalita je nižší než Claude; viz konec.)

| Vrstva | Služba | Free limit |
|---|---|---|
| Web | Vercel Hobby | zdarma (nekomerční použití) |
| DB + Auth | Supabase Free | 500 MB, projekt se uspí po týdnu nečinnosti |
| Worker + plánovač | GitHub Actions | public repo = neomezeně; private = 2000 min/měs |
| Transkripce | Groq Whisper | rate-limited, zdarma |
| Sumarizace | Groq LLM (Llama) | rate-limited, zdarma |

Potřebuješ free účty: **GitHub, Supabase, Vercel, Groq** (groq.com → API key).

---

## 1) Supabase (DB + Auth)

1. Vytvoř projekt na [supabase.com](https://supabase.com).
2. **SQL Editor** → postupně vlož a spusť všechny soubory z
   `supabase/migrations/` (v pořadí podle názvu).
3. **Settings → API** → zkopíruj `Project URL`, `anon key`, `service_role key`.
4. **Authentication → Providers**: nech zapnutý **Email** (magic link funguje
   hned). Google je volitelný (přidej redirect `https://TVUJ-WEB/auth/callback`).
   - Pozn.: vestavěné odesílání e-mailů Supabase má nízký limit. Pro víc přidej
     zdarma SMTP (Resend/Brevo) v *Auth → SMTP*, nebo používej hlavně Google.

## 2) GitHub (kód + worker)

1. Nahraj repo na GitHub. **Doporučení: public repo** → GitHub Actions jsou pak
   neomezené zdarma (secrets zůstávají bezpečně v *Settings → Secrets*).
2. **Settings → Secrets and variables → Actions → New repository secret** —
   přidej:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`
   - (volitelně `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `TADDY_API_KEY`,
     `TADDY_USER_ID`)
3. (Volitelně) **Variables** (ne secrets): `LLM_PROVIDER=groq`,
   `TRANSCRIPTION_PROVIDER=groq` — workflow je má jako default, takže nemusíš.
4. Workflow `.github/workflows/pipeline.yml` se spustí sám každých 30 min.
   První běh spusť ručně přes **Actions → PodBrief pipeline → Run workflow**.

> **Private repo?** 2000 min/měs nemusí stačit při běhu každých 30 min. Buď dej
> repo public, nebo v `pipeline.yml` zvyš interval (např. `0 * * * *` = jednou
> za hodinu). „Nová epizoda do 60 min" se pak řídí tímto intervalem.

## 3) Vercel (web)

1. [vercel.com](https://vercel.com) → **Add New → Project** → importuj GitHub repo.
2. **Environment Variables** — přidej:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = tvoje produkční URL (např.
     `https://podbrief.vercel.app`)
   - `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `TRANSCRIPTION_PROVIDER=groq`
   - (volitelně `CRON_SECRET`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`)
3. Deploy. Hotovo — web běží.

> `vercel.json` má jen **denní** cron (Hobby neumí častější). Je to jen záloha;
> skutečný plánovač je GitHub Actions. Klidně ho ignoruj.

## 4) Naseeduj katalog a udělej ze sebe admina

Lokálně (s `.env.local` vyplněným ze `.env.example`):

```bash
pnpm install
pnpm db:seed                      # naplní ~30 shows reálnými RSS feedy
```

Přihlas se na webu (magic link), pak v Supabase SQL editoru:

```sql
update profiles set role = 'admin' where user_id = '<tvoje auth uid>';
```

UID najdeš v Supabase → Authentication → Users. Pak máš přístup na `/admin`.

---

## Jak zůstat ve free limitech

- **`MAX_EPISODES_PER_DAY`** (default 40) je pojistka proti utrženým nákladům i
  proti vyčerpání Groq rate limitů. Klidně sniž.
- **Groq rate limits** (zdarma): při náporazu se job sám naplánuje s backoffem a
  dotáhne se v dalším ticku — nic se neztratí.
- **Supabase se uspí** po týdnu nečinnosti; první request ho probudí (pár
  sekund). GitHub Actions tick každých 30 min ho de facto drží vzhůru.

## Kvalita zdarma vs. placeně

- `LLM_PROVIDER=groq` → **zdarma**, ale Llama píše briefy hůř než Claude.
- `LLM_PROVIDER=anthropic` → kvalitnější (to je ten „moat"), ale platí se ~pár
  centů za brief. Můžeš mít hybrid: extrakce na Groqu zdarma, editorial na
  Claude — nastav `LLM_PROVIDER=anthropic` jen občas, nebo si uprav `modelFor()`
  v `src/lib/pipeline/llm.ts`.
- Doporučení: rozjeď to celé zdarma na Groqu, vylaď prompty
  (`src/lib/pipeline/prompts.ts`), a pokud budeš chtít vyšší kvalitu, přepni
  editorial pass na Claude — je to jen změna env proměnné.

## Lokální běh workeru (alternativa ke GitHub Actions)

Když chceš zpracovávat lokálně (např. při ladění), místo Actions:

```bash
pnpm tick --ingest   # jeden průchod: stáhni feedy + zpracuj frontu
pnpm worker          # nebo nekonečná smyčka (always-on)
```
