/**
 * Hamadryad — Comment Auto-Moderation
 * Blocks racist, hateful, and illegal content before it's saved.
 * Pattern matching is case-insensitive and accounts for simple character
 * substitutions (e.g. @ for a, 3 for e, 1 for i).
 */

// ── Normalise text (collapse leet-speak / special chars) ──────────────────────
function normalise(text) {
    return text
        .toLowerCase()
        .replace(/@/g, 'a')
        .replace(/4/g, 'a')
        .replace(/3/g, 'e')
        .replace(/1/g, 'i')
        .replace(/!/g, 'i')
        .replace(/0/g, 'o')
        .replace(/\$/g, 's')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/\+/g, 't')
        .replace(/[-_.* ]+/g, ' ')  // collapse separators
        .trim();
}

// ── Blocked term categories ───────────────────────────────────────────────────

// Racial slurs and targeted hate speech (partial list of the most common terms)
const HATE_PATTERNS = [
    /\bn[i!1]+gg[e3a]+r/,
    /\bn[i!1]+gg[ae3]/,
    /\bc[o0]+[o0]+n\b/,
    /\bs[a@]+mp[o0]+/,
    /\bch[i!1]+nk\b/,
    /\bg[o0]+[o0]+k\b/,
    /\bsp[i!1]+c[k]?\b/,
    /\bw[e3]+tb[a@]+ck\b/,
    /\bk[i!1]+k[e3]\b/,
    /\bch[i!1]+nk[s]?\b/,
    /\btardb[a@]+by/,
    /\br[e3]+t[a@]+rd[e3]?d?\b/,
    /\bh[e3]+b[o0]+\b/,
    /\bs[a@]+nd ?n[i!1]gg[e3a]+r/,
    /\btr[a@]+nn[y]+/,
    /\bf[a@]+gg[o0]+t/,
    /\bf[a@]+g\b/,
    /\bd[y]+k[e3]\b/,
    /\bj[i!1]+g[a@]+b[o0]+[o0]/,
    /\bc[o0]+[o0]+lie\b/,
    /\bwh[i!1]+t[e3] ?tr[a@]+sh\b/,
    /\bwh[i!1]+t[e3]? ?p[o0]+w[e3]+r\b/,
    /\bh[i!1]+tl[e3]+r /,
    /\bh[a@]+[i!1]+l h[i!1]+tl[e3]+r/,
    /\bn[a@]+z[i!1] /,
    /\bk[k]+k\b/,
    /\bkl[a@]+nsman/,
    /\bku kl[u]+x/,
    /death to (all )?(jews|blacks|whites|muslims|christians|gays)/,
    /\bblack monkey\b/,
    /\bmonkey (go )?back/,
    /\bape (go )?back/,
];

// Illegal content keywords
const ILLEGAL_PATTERNS = [
    // Drug dealing
    /\b(sell|buy|selling|buying|ship|ships|shipping)\s+(meth|cocaine|heroin|fentanyl|crack|coke|dope|ice|crystal)\b/,
    /\b(meth|cocaine|heroin|fentanyl|crack)\s+(for sale|available|supplier|dealer)/,
    /\bdrug dealer\b/,
    /\bdarkweb|dark web\b/,
    /\bsilk ?road\b/,
    // Weapons trafficking
    /\b(unregistered|illegal|untraceable)\s+(gun|guns|firearm|rifle|pistol|weapon)/,
    /\b(buy|sell|selling|buying)\s+(guns?|firearms?|rifles?|pistols?)\s+(illegally|online|no background check)/,
    /\bghost ?gun\b/,
    // Child exploitation (strict)
    /\bcp\b.{0,20}\b(sell|buy|trade|free|download)/,
    /\bchild (porn|porno|pornography)/,
    /\blolita\b.{0,30}\b(sell|buy|trade|download)/,
    /\bunderage\b.{0,20}\b(sex|nude|naked|porn)/,
    // Fraud / scam
    /\b(stolen|fake)\s+(credit cards?|cc|cvv|ssn|identity documents?)/,
    /\b(buy|sell|get)\s+(fake)\s+(id|passport|license|documents?)/,
    /\bbank ?account hacking?\b/,
    /\b(phishing|carding)\s+(kit|tutorial|service)/,
    // Violence threats (direct)
    /\bi('ll| will| am going to) (kill|murder|shoot|bomb|attack) (you|him|her|them|everyone)/,
    /\b(kill|murder) (yourself|urself)\b/,  // keep self-harm blocking
    /\bbomb threat\b/,
    /\bschool ?shooting\b/,
    /\bmass ?shooting\b/,
];

// Spam / scam patterns
const SPAM_PATTERNS = [
    /\b(click here|click now|visit now)\s+https?/,
    /\b(earn|make)\s+\$\d+\s+(a day|per day|daily|weekly|an hour|per hour)/,
    /\b(get rich|get paid|make money)\s+(fast|quick|easy|now|online)/,
    /\b(casino|betting|gambling)\s+(site|bonus|signup|free chips)/,
    /\b(free followers|buy followers|buy likes|buy subscribers)/,
    /\bviagra\b/,
    /\bcialis\b/,
    /\bbitcoin (investment|mining|trading) (opportunity|scheme|program)/,
];

// ── Main check function ───────────────────────────────────────────────────────
/**
 * @param {string} text - The comment body (and optionally name) to check.
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkContent(text) {
    if (!text || typeof text !== 'string') return { blocked: false };

    const norm = normalise(text);

    for (const pattern of HATE_PATTERNS) {
        if (pattern.test(norm)) {
            return { blocked: true, reason: 'Your comment contains language that is not permitted on this site.' };
        }
    }

    for (const pattern of ILLEGAL_PATTERNS) {
        if (pattern.test(norm)) {
            return { blocked: true, reason: 'Your comment appears to contain content that may be illegal or promote illegal activity.' };
        }
    }

    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(norm)) {
            return { blocked: true, reason: 'Your comment was flagged as spam.' };
        }
    }

    return { blocked: false };
}

module.exports = { checkContent };
