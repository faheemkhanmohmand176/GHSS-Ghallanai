import { NextResponse } from "next/server";

/**
 * WORD OF THE DAY — Babi Khel homepage feature, Next.js edition.
 *
 *  GET /api/word-of-day        → one curated word per PKT calendar date
 *                                (deterministic, zero external calls).
 *  GET /api/word-of-day?word=w → live Free Dictionary API lookup (used by
 *                                the double-click definition popup).
 *
 * The dataset is embedded (like the original) so the feature works offline
 * and on free-tier deployments with zero API keys.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WordEntry {
  word: string;
  phonetic: string;
  meanings: { part: string; definitions: { definition: string; example?: string }[]; synonyms?: string[] }[];
}

const WORDS: WordEntry[] = [
  { word: "aspiration", phonetic: "/ˌæs.pəˈreɪ.ʃən/", meanings: [{ part: "noun", definitions: [{ definition: "A hope or ambition of achieving something.", example: "Her aspiration was to become a doctor and serve her district." }], synonyms: ["ambition", "dream", "goal"] }] },
  { word: "diligent", phonetic: "/ˈdɪl.ɪ.dʒənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Showing careful and persistent effort in work.", example: "A diligent student revises a little every day." }], synonyms: ["hardworking", "assiduous", "industrious"] }] },
  { word: "curriculum", phonetic: "/kəˈrɪk.jə.ləm/", meanings: [{ part: "noun", definitions: [{ definition: "The subjects comprising a course of study.", example: "The ICS curriculum includes computer science and mathematics." }] }] },
  { word: "resilience", phonetic: "/rɪˈzɪl.jəns/", meanings: [{ part: "noun", definitions: [{ definition: "The capacity to recover quickly from difficulties.", example: "Resilience carried her through the examination season." }], synonyms: ["toughness", "grit"] }] },
  { word: "integrity", phonetic: "/ɪnˈteɡ.rə.ti/", meanings: [{ part: "noun", definitions: [{ definition: "The quality of being honest and holding strong moral principles.", example: "A school teaches integrity as much as arithmetic." }], synonyms: ["honesty", "principle"] }] },
  { word: "analyse", phonetic: "/ˈæn.əl.aɪz/", meanings: [{ part: "verb", definitions: [{ definition: "Examine methodically by separating into parts and studying them.", example: "Analyse the past paper before you attempt it." }], synonyms: ["examine", "study"] }] },
  { word: "phenomenon", phonetic: "/fɪˈnɒm.ɪ.nən/", meanings: [{ part: "noun", definitions: [{ definition: "A fact or event observed in science.", example: "Refraction is a phenomenon every physics student meets." }], synonyms: ["occurrence", "event"] }] },
  { word: "mitigate", phonetic: "/ˈmɪt.ɪ.ɡeɪt/", meanings: [{ part: "verb", definitions: [{ definition: "Make less severe or harmful.", example: "Revision mitigates examination anxiety." }], synonyms: ["reduce", "lessen"] }] },
  { word: "articulate", phonetic: "/ɑːˈtɪk.jə.lət/", meanings: [{ part: "verb", definitions: [{ definition: "Express an idea clearly and effectively.", example: "Debating teaches students to articulate arguments." }], synonyms: ["express", "enunciate"] }] },
  { word: "symbiosis", phonetic: "/ˌsɪm.baɪˈoʊ.sɪs/", meanings: [{ part: "noun", definitions: [{ definition: "Interaction between two organisms living in close association.", example: "Rhizobium and legumes live in symbiosis." }], synonyms: ["mutualism"] }] },
  { word: "threshold", phonetic: "/ˈθreʃ.həʊld/", meanings: [{ part: "noun", definitions: [{ definition: "The level at which something starts to happen.", example: "The merit threshold rose this session." }], synonyms: ["limit", "boundary"] }] },
  { word: "meticulous", phonetic: "/məˈtɪk.jə.ləs/", meanings: [{ part: "adjective", definitions: [{ definition: "Showing great attention to detail.", example: "Keep a meticulous practical notebook." }], synonyms: ["thorough", "precise"] }] },
  { word: "catalyst", phonetic: "/ˈkæt.ə.l.ɪst/", meanings: [{ part: "noun", definitions: [{ definition: "A substance that speeds a reaction without being consumed.", example: "Enzymes are biological catalysts." }, { definition: "A person or thing that provokes change.", example: "A good teacher is the catalyst of a classroom." }], synonyms: ["accelerant"] }] },
  { word: "coherent", phonetic: "/kəʊˈhɪə.rənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Logical and consistent in argument.", example: "Write coherent answers — examiners reward structure." }], synonyms: ["logical", "consistent"] }] },
  { word: "diverse", phonetic: "/daɪˈvɜːs/", meanings: [{ part: "adjective", definitions: [{ definition: "Showing a great deal of variety.", example: "Ghallanai sends a diverse cohort to the boards every year." }], synonyms: ["varied", "assorted"] }] },
  { word: "empirical", phonetic: "/ɪmˈpɪr.ɪ.kəl/", meanings: [{ part: "adjective", definitions: [{ definition: "Based on observation and experiment rather than theory.", example: "Science demands empirical evidence." }], synonyms: ["observed", "experimental"] }] },
  { word: "feasible", phonetic: "/ˈfiː.zə.bəl/", meanings: [{ part: "adjective", definitions: [{ definition: "Possible to do easily or conveniently.", example: "A two-week revision plan is feasible." }], synonyms: ["possible", "practicable"] }] },
  { word: "genuine", phonetic: "/ˈdʒen.ju.ɪn/", meanings: [{ part: "adjective", definitions: [{ definition: "Truly what it is said to be; authentic.", example: "A genuine interest in learning outlasts grades." }], synonyms: ["authentic", "real"] }] },
  { word: "hypothesis", phonetic: "/haɪˈpɒθ.ə.sɪs/", meanings: [{ part: "noun", definitions: [{ definition: "A proposed explanation to be tested.", example: "State your hypothesis before the practical." }], synonyms: ["theory", "proposition"] }] },
  { word: "inevitable", phonetic: "/ɪˈnev.ɪ.tə.bəl/", meanings: [{ part: "adjective", definitions: [{ definition: "Certain to happen; unavoidable.", example: "Board exams are inevitable — preparation is optional." }], synonyms: ["unavoidable", "certain"] }] },
  { word: "jurisdiction", phonetic: "/ˌdʒʊə.rɪsˈdɪk.ʃən/", meanings: [{ part: "noun", definitions: [{ definition: "The official power to make legal decisions.", example: "Civics students study the jurisdiction of courts." }], synonyms: ["authority", "power"] }] },
  { word: "lucid", phonetic: "/ˈluː.sɪd/", meanings: [{ part: "adjective", definitions: [{ definition: "Expressed clearly and easy to understand.", example: "Her notes were so lucid the whole group copied them." }], synonyms: ["clear", "intelligible"] }] },
  { word: "momentum", phonetic: "/məˈmen.təm/", meanings: [{ part: "noun", definitions: [{ definition: "The quantity of motion of a moving body.", example: "Momentum equals mass times velocity." }, { definition: "Impetus gained by a process.", example: "Keep your revision momentum through the month." }] }] },
  { word: "novel", phonetic: "/ˈnɒv.əl/", meanings: [{ part: "adjective", definitions: [{ definition: "New or unusual in an interesting way.", example: "A novel approach to the essay earned full marks." }], synonyms: ["new", "original"] }] },
  { word: "obsolete", phonetic: "/ˌɒb.səˈliːt/", meanings: [{ part: "adjective", definitions: [{ definition: "No longer in use; out of date.", example: "Punched cards are obsolete — computer science moves fast." }], synonyms: ["outdated", "superseded"] }] },
  { word: "persistent", phonetic: "/pəˈsɪs.tənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Continuing firmly in a course of action.", example: "Persistent practice beats last-night cramming." }], synonyms: ["tenacious", "persevering"] }] },
  { word: "quintessential", phonetic: "/ˌkwɪn.tɪˈsen.ʃəl/", meanings: [{ part: "adjective", definitions: [{ definition: "Representing the most perfect example of something.", example: "The topper was the quintessential hard worker." }], synonyms: ["typical", "archetypal"] }] },
  { word: "rigorous", phonetic: "/ˈrɪɡ.ər.əs/", meanings: [{ part: "adjective", definitions: [{ definition: "Extremely thorough and careful.", example: "Board marking is rigorous — show every step." }], synonyms: ["thorough", "exacting"] }] },
  { word: "synthesize", phonetic: "/ˈsɪn.θə.saɪz/", meanings: [{ part: "verb", definitions: [{ definition: "Combine separate elements into a coherent whole.", example: "Synthesize both books into one answer." }], synonyms: ["combine", "integrate"] }] },
  { word: "tenacious", phonetic: "/təˈneɪ.ʃəs/", meanings: [{ part: "adjective", definitions: [{ definition: "Holding firmly to something; not giving up.", example: "A tenacious candidate reattempts the paper calmly." }], synonyms: ["persistent", "determined"] }] },
  { word: "ubiquitous", phonetic: "/juːˈbɪk.wɪ.təs/", meanings: [{ part: "adjective", definitions: [{ definition: "Present everywhere at once.", example: "The mobile phone is ubiquitous in Ghallanai." }], synonyms: ["omnipresent", "widespread"] }] },
  { word: "vibrant", phonetic: "/ˈvaɪ.brənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Full of energy and life.", example: "The campus was vibrant on sports day." }], synonyms: ["lively", "energetic"] }] },
  { word: "warrant", phonetic: "/ˈwɒr.ənt/", meanings: [{ part: "verb", definitions: [{ definition: "Justify or deserve.", example: "Three absences warrant a call home." }], synonyms: ["justify", "merit"] }] },
  { word: "zenith", phonetic: "/ˈzen.ɪθ/", meanings: [{ part: "noun", definitions: [{ definition: "The highest point reached in the sky or in one's career.", example: "Reaching the merit list's zenith took two years of work." }], synonyms: ["peak", "summit"] }] },
  { word: "alacrity", phonetic: "/əˈlæk.rə.ti/", meanings: [{ part: "noun", definitions: [{ definition: "Brisk and cheerful readiness.", example: "She accepted the extra class with alacrity." }], synonyms: ["eagerness", "readiness"] }] },
  { word: "benevolent", phonetic: "/bəˈnev.əl.ənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Kind and generous.", example: "A benevolent fee concession policy keeps students in class." }], synonyms: ["kind", "charitable"] }] },
  { word: "cogent", phonetic: "/ˈkəʊ.dʒənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Clear, logical and convincing.", example: "A cogent argument wins the debate." }], synonyms: ["convincing", "compelling"] }] },
  { word: "dexterity", phonetic: "/dekˈster.ə.ti/", meanings: [{ part: "noun", definitions: [{ definition: "Skill in performing tasks with the hands.", example: "Dissection requires dexterity." }], synonyms: ["skill", "adroitness"] }] },
  { word: "eloquent", phonetic: "/ˈel.ə.kwənt/", meanings: [{ part: "adjective", definitions: [{ definition: "Fluent and persuasive in speech or writing.", example: "An eloquent speech closed the annual day." }], synonyms: ["articulate", "expressive"] }] },
  { word: "frugal", phonetic: "/ˈfruː.ɡəl/", meanings: [{ part: "adjective", definitions: [{ definition: "Careful with money or resources.", example: "Frugal use of lab reagents is good science and good sense." }], synonyms: ["thrifty", "economical"] }] },
  { word: "germinate", phonetic: "/ˈdʒɜː.mɪ.neɪt/", meanings: [{ part: "verb", definitions: [{ definition: "Begin to grow after a period of dormancy.", example: "Seeds germinate in moist cotton for the biology practical." }], synonyms: ["sprout"] }] },
  { word: "implicit", phonetic: "/ɪmˈplɪs.ɪt/", meanings: [{ part: "adjective", definitions: [{ definition: "Understood though not directly expressed.", example: "Trust in the merit list is implicit in its publication." }], synonyms: ["implied", "inherent"] }] },
  { word: "juxtapose", phonetic: "/ˈdʒʌk.stə.pəʊz/", meanings: [{ part: "verb", definitions: [{ definition: "Place close together for contrasting effect.", example: "Juxtapose the two poems in one comparative answer." }], synonyms: ["contrast"] }] },
  { word: "kinetic", phonetic: "/kɪˈnet.ɪk/", meanings: [{ part: "adjective", definitions: [{ definition: "Relating to motion.", example: "Double the speed and kinetic energy quadruples." }], synonyms: ["motional"] }] },
  { word: "lateral", phonetic: "/ˈlæt.ər.əl/", meanings: [{ part: "adjective", definitions: [{ definition: "Relating to the side; thinking that explores unusual angles.", example: "Lateral thinking solves the odd physics puzzle." }] }] },
  { word: "mediate", phonetic: "/ˈmiː.di.eɪt/", meanings: [{ part: "verb", definitions: [{ definition: "Intervene between people to resolve a dispute.", example: "Senior teachers mediate disputes calmly." }], synonyms: ["arbitrate", "reconcile"] }] },
  { word: "navigate", phonetic: "/ˈnæv.ɪ.ɡeɪt/", meanings: [{ part: "verb", definitions: [{ definition: "Plan and direct a route.", example: "Navigate the admission timeline carefully." }], synonyms: ["steer", "pilot"] }] },
  { word: "optimum", phonetic: "/ˈɒp.tɪ.məm/", meanings: [{ part: "noun", definitions: [{ definition: "The best or most favourable level.", example: "Six hours of sleep is the optimum during exams." }], synonyms: ["best", "ideal"] }] },
  { word: "pragmatic", phonetic: "/præɡˈmæt.ɪk/", meanings: [{ part: "adjective", definitions: [{ definition: "Dealing with matters in a practical way.", example: "A pragmatic timetable beats an ambitious one." }], synonyms: ["practical", "realistic"] }] },
  { word: "quorum", phonetic: "/ˈkwɔː.rəm/", meanings: [{ part: "noun", definitions: [{ definition: "The minimum number needed for a valid meeting.", example: "The council needs a quorum of five teachers." }] }] },
  { word: "resolute", phonetic: "/ˈrez.ə.luːt/", meanings: [{ part: "adjective", definitions: [{ definition: "Firm and determined in purpose.", example: "Resolute revision timetables survive week one." }], synonyms: ["determined", "firm"] }] },
  { word: "scrutinize", phonetic: "/ˈskruː.tɪ.naɪz/", meanings: [{ part: "verb", definitions: [{ definition: "Examine closely and critically.", example: "Scrutinize the admit card for errors before exam day." }], synonyms: ["inspect", "examine"] }] },
  { word: "tentative", phonetic: "/ˈten.tə.tɪv/", meanings: [{ part: "adjective", definitions: [{ definition: "Not certain; provisional.", example: "The date sheet is tentative until the board confirms it." }], synonyms: ["provisional", "unconfirmed"] }] },
  { word: "unanimous", phonetic: "/juːˈnæn.ɪ.məs/", meanings: [{ part: "adjective", definitions: [{ definition: "Fully in agreement.", example: "The faculty was unanimous on the new testing policy." }], synonyms: ["consensual"] }] },
  { word: "versatile", phonetic: "/ˈvɜː.sə.taɪl/", meanings: [{ part: "adjective", definitions: [{ definition: "Able to adapt to many functions.", example: "A versatile student switches streams without fear." }], synonyms: ["adaptable", "all-round"] }] },
  { word: "wary", phonetic: "/ˈweə.ri/", meanings: [{ part: "adjective", definitions: [{ definition: "Feeling caution about dangers.", example: "Be wary of fake result websites." }], synonyms: ["cautious", "careful"] }] },
  { word: "xenial", phonetic: "/ˈziː.ni.əl/", meanings: [{ part: "adjective", definitions: [{ definition: "Relating to hospitality between host and guest.", example: "The xenial tradition of the district welcomes transfer students." }] }] },
  { word: "yearn", phonetic: "/jɜːn/", meanings: [{ part: "verb", definitions: [{ definition: "Deeply long for something.", example: "Students yearn to see their name on the merit list." }], synonyms: ["long", "crave"] }] },
  { word: "zeal", phonetic: "/ziːl/", meanings: [{ part: "noun", definitions: [{ definition: "Great energy or enthusiasm for a cause.", example: "She studied the whole syllabus with zeal." }], synonyms: ["passion", "enthusiasm"] }] },
];

/** Deterministic PKT-day index (Asia/Karachi, UTC+5, no DST). */
function pktDayIndex(): number {
  const pkt = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(pkt.getUTCFullYear(), 0, 0));
  return Math.floor((pkt.getTime() - start.getTime()) / 86_400_000);
}

function formatEntry(entry: WordEntry, date = "") {
  return { date, word: entry.word, phonetic: entry.phonetic, meanings: entry.meanings.slice(0, 3) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const single = searchParams.get("word")?.trim().toLowerCase();

  // ---- Live lookup mode (double-click definition popup) ----
  if (single) {
    if (!/^[a-z-]{2,40}$/.test(single)) {
      return NextResponse.json({ error: "Invalid word." }, { status: 400 });
    }
    const local = WORDS.find((w) => w.word === single);
    if (local) return NextResponse.json(formatEntry(local));
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(single)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return NextResponse.json({ error: "No definition found." }, { status: 404 });
      const data = (await res.json()) as Array<{
        word: string;
        phonetic?: string;
        meanings: Array<{
          partOfSpeech: string;
          definitions: Array<{ definition: string; example?: string }>;
          synonyms?: string[];
        }>;
      }>;
      const first = data[0];
      return NextResponse.json({
        word: first.word,
        phonetic: first.phonetic ?? "",
        meanings: first.meanings.slice(0, 3).map((m) => ({
          part: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2),
          synonyms: m.synonyms?.slice(0, 3),
        })),
      });
    } catch {
      return NextResponse.json({ error: "Dictionary lookup failed." }, { status: 502 });
    }
  }

  // ---- Word of the Day mode ----
  const entry = WORDS[pktDayIndex() % WORDS.length];
  const pkt = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return NextResponse.json(
    formatEntry(entry, pkt.toISOString().slice(0, 10)),
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
