# PodBrief — strategie & rizika (z council review)

Shrnutí závěrů z council review PRD a jak na ně projekt odpovídá. Rozlišuje
**[kód]** (hotové v repu) od **[na tobě]** (rozhodnutí/akce mimo kód).

---

## 1. Use-case: zvoleno — TRIAGE (ne náhrada poslechu)

Council našel zásadní rozpor: „time arbitrage" (brief nahrazuje poslech) vs.
„triage" (brief pomáhá rozhodnout, jestli poslouchat). Jsou to opačné produkty
s opačnou churn dynamikou i právní expozicí.

**Rozhodnutí (PRD v2 §1): primárně TRIAGE.** „Chci vědět, jestli tahle epizoda
stojí za 3 hodiny, než se do ní pustím." CTA je vždy „Listen to the full
episode →". Substitute-listening nezakazujeme, ale neoptimalizujeme pro něj —
limit ≤1 citát/<15 slov a prominentní odkaz na originál nás drží na správné
straně fair use bez ohledu na to, jak briefy lidi reálně používají.

- **[kód]** Reader vede „Listen to the full episode" CTA + „independent summary"
  disclosure. Landing říká problém i triage framing na rovinu.

## 2. Co je reálný moat (a co z toho je postavené)

„Editorial quality" **není** moat (council jednomyslně) — je to prompt
engineering, který konkurent zkopíruje za víkend. Reálné moaty:

1. **SEO akumulace** — každý publikovaný brief = veřejná indexovaná stránka.
   30 shows × ~50 epizod/rok = 1500+ stránek za rok 1, compounduje.
   **[kód] hotové:** veřejné `/b/...` stránky (ISR), sitemap, robots, JSON-LD
   `Article`, OG obrázky, veřejné RSS `/rss.xml`.
2. **Data flywheel** — timestampované claimy/entity/disagreements napříč
   stovkami epizod = prohledávatelná databáze „co chytří lidé říkali o tématu X".
   **[kód] hotové (Day-1 architektura):** ukládáme plný transkript + segmenty
   **a teď i celou extrakci** (`briefs.extraction`: claims, entities, numbers,
   disagreements, quotes). Samotná cross-episode search/feature = Year 2, ale
   data se sbírají od začátku.
3. **Kurátorský katalog** — „pokrýváme, co v tech/financích dává signál" je
   značka, ne filtr. Udržitelné jedním člověkem; důvěru konkurent nedožene roky.
4. **Vztahy s tvůrci** — když show týmy začnou sdílet PodBrief odkazy (protože
   briefy ženou poslechy), to je distribuce, co se nedá koupit.
   **[kód]** Partner „Featured" badge připravený.

## 3. #1 RIZIKO: copyright (existenční)

Každý peer reviewer to označil za fatal flaw. Automatické shrnování komerčního
podcast obsahu pro placený produkt **není šedá zóna**, jakmile se monetizuje.

**[kód] hotové (PRD v2 §3):**
- ≤1 verbatim citát <15 slov, **vynuceno v `validate.ts`**.
- `shows.dmca_hold` (jeden klik skryje všechny briefy show; vynuceno i v RLS),
  reverzibilní.
- `ingest_source='blocked'` pro Spotify Exclusive / paywall / „no-summarization".
- `takedown@podbrief.com` na **každé** brief stránce + log requestů +
  `/admin/takedowns`.
- Prominentní odkaz na originál + „independent summary" disclosure.

**[na tobě] — než pustíš první PLATÍCÍ uživatele:**
- Písemné fair-use stanovisko od copyright advokáta (digital media), rozpočet
  $500–1500. Nejlevnější pojistka.
- Do katalogu neber Spotify Originals, iHeart exkluzivity, Pushkin placené feedy
  → označ `ingest_source='blocked'`. (Aktuální seed je jen veřejné RSS, žádný
  Spotify Original.)
- Rozeslat Partner e-maily show týmům s ukázkou; opt-out → okamžitě `dmca_hold`.

## 4. Konkurence (PRD v2 §2)

Snipd (clip-while-listening, mobile), Podwise/Podsqueeze (paste-a-link, per
request), Spotify AI Chapters (vyžaduje poslech), Morning Brew/Axios (news, ne
audio-native). **Pozice PodBrief:** jediný, kdo kombinuje (a) centrální
zpracování s editorial konzistencí, (b) kurátorský high-signal katalog, (c)
personalizovaný feed (ne nástroj), (d) veřejné SEO brief stránky.

## 5. Cost: architektura to drží (council „cost math wrong" — mitigováno)

Obava: dlouhé epizody (Lex/Acquired 3–6 h ≈ 80k tokenů) přejedou rozpočet na
Sonnetu.

**Proč to v našem designu nehoří:**
- Editorial pass (drahý model) **nečte transkript** — čte jen malou extrakci
  (JSON). Plný transkript čte jen pass-1 na **levném** modelu (Haiku/Llama).
- **Free path = $0** (Groq Llama + Whisper), viz `docs/DEPLOY-FREE.md`.
- Pojistky: `MAX_EPISODES_PER_DAY`, cap délky transkriptu pro extrakci,
  per-epizoda cost logging + `daily_costs` view v adminu.

## 6. Day-0 validace (council „nejlevnější test")

Než cokoli škálovat: ručně vygeneruj 5–10 briefů, publikuj je, změř, jestli je
někdo sdílí / přečte. Tooling je hotový:

```
pnpm process-episode "<feed-url>"     # vytiskne brief; pusť na 5–10 epizodách
```

Čti výstupy, lP filtruj failure modes, laď `src/lib/pipeline/prompts.ts`. Teprve
když briefy projdou §2 bar, má smysl řešit růst.

## 7. Co jsme záměrně NEpostavili (council: nepředbíhej)

Žádné B2B/API/white-label/cross-episode search/email digesty — to je Year 2
(„platform thinking před product-market fit = infrastruktura, kterou nikdo
nepoužije"). Architektura to umožní, ale launch je B2C triage reader.
