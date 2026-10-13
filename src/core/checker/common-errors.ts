/**
 * Typical mistakes of Russian speakers writing English, found in any text regardless of the task.
 * The rules are conservative regular expressions: they should rarely fire on correct English.
 * Results are advice shown next to the task-specific check, not a reason to fail an answer.
 */
import { normalizeApostrophes } from '../content/lexical';

export interface Advice {
  id: string;
  /** The words that triggered the rule, as the learner wrote them. */
  fragment: string;
  message: string;
}

interface Rule {
  id: string;
  pattern: RegExp;
  message: string;
  /** Rejects a match that is actually fine. */
  except?: (match: RegExpExecArray, text: string) => boolean;
}

/** "Does he like…?", "she can go", "to let it go": the bare verb is right after these. */
const BARE_VERB_BEFORE =
  /\b(?:does|did|do|can|could|will|would|shall|should|may|might|must|to|let|lets)\s+$/i;

// "a" before a vowel sound and "an" before a consonant sound; the common spelling exceptions.
const A_BEFORE_VOWEL_SOUND = /^(uni|use|usu|uti|eu|one|once|ubiq)/i;
const AN_BEFORE_CONSONANT_SOUND = /^(hour|honest|honou?r|heir)/i;

const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const THIRD_PERSON_VERBS =
  'have|do|go|like|love|want|live|work|play|speak|eat|know|need|read|study|think|come|make|take|get|see|drink|watch|help|say';

const RULES: Rule[] = [
  {
    id: 'i-lowercase',
    // Case-sensitive on purpose (see `find`): a lowercase pronoun "i".
    pattern: /(?:^|[\s,.;:!?(])(i)(?=$|[\s,.;:!?)']|'[a-z])/g,
    message: 'местоимение I всегда пишется с большой буквы.',
  },
  {
    id: 'am-agree',
    pattern: /\bI am (agree|disagree|think|know|want|like|love|need)\b/gi,
    message: 'после I am глагол не нужен: I agree, I think, I know (am — только с прилагательным).',
  },
  {
    id: 'have-years',
    pattern: /\b(?:I|he|she|we|they|you) (?:have|has) \d+ years?\b/gi,
    message: 'возраст выражается через to be: I am 20 years old.',
  },
  {
    id: 'third-person-s',
    pattern: new RegExp(`\\b(?:he|she|it) (?:${THIRD_PERSON_VERBS})\\b`, 'gi'),
    message: 'после he/she/it в Present Simple глагол получает -s: he likes, she works, it has.',
    except: (m, t) => BARE_VERB_BEFORE.test(t.slice(0, m.index)),
  },
  {
    id: 'people-is',
    pattern: /\b(?:people|children|men|women|police) (?:is|was|has)\b/gi,
    message:
      'people, children, men, women и police — множественное число: people are, children have.',
  },
  {
    id: 'did-past',
    pattern:
      /\b(?:didn't|did not|don't|do not|doesn't|does not|didn't) (?:went|saw|had|ate|came|did|got|took|made|said|knew|wrote)\b/gi,
    message: "после did/does/do глагол стоит в начальной форме: I didn't go, she doesn't know.",
  },
  {
    id: 'double-comparative',
    pattern: /\bmore (?:better|worse|bigger|smaller|easier|older|younger|faster|cheaper)\b/gi,
    message: 'сравнительная степень образуется один раз: better (а не more better), bigger.',
  },
  {
    id: 'very-like',
    pattern: /\bI (?:very|much) (?:like|love|enjoy)\b/gi,
    message: 'very стоит перед прилагательным; «очень люблю» — I like it a lot / I really like it.',
  },
  {
    id: 'day-preposition',
    pattern: new RegExp(`\\b(?:in|at) (?:the )?(?:${DAYS})\\b`, 'gi'),
    message: 'с днями недели используется on: on Monday.',
  },
  {
    id: 'there-have',
    pattern: /\bthere (?:have|has) (?:a|an|some|many|\d+)\b/gi,
    message: '«Есть, имеется» — there is / there are, а не there have.',
  },
  {
    id: 'a-before-vowel',
    pattern: /\ba ([aeiou][a-z']*)/gi,
    message: 'перед гласным звуком используется an: an apple, an engineer.',
    except: (m) => A_BEFORE_VOWEL_SOUND.test(m[1]!),
  },
  {
    id: 'an-before-consonant',
    pattern: /\ban ([bcdfghjklmnpqrstvwxyz][a-z']*)/gi,
    message: 'перед согласным звуком используется a: a book, a teacher.',
    except: (m) => AN_BEFORE_CONSONANT_SOUND.test(m[1]!),
  },
];

/** Finds typical mistakes in `text`; each rule reports at most once. */
export function findCommonMistakes(text: string): Advice[] {
  const t = normalizeApostrophes(text).replace(/\s+/g, ' ');
  const found: Advice[] = [];
  for (const rule of RULES) {
    // The "i" rule is the only case-sensitive one; the others carry the i flag themselves.
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (m[0] === '') re.lastIndex++;
      if (rule.except?.(m, t)) continue;
      // The lowercase-"i" rule must not match "I".
      if (rule.id === 'i-lowercase' && m[1] !== 'i') continue;
      found.push({
        id: rule.id,
        fragment: (rule.id === 'i-lowercase' ? 'i' : m[0]).trim(),
        message: rule.message,
      });
      break;
    }
  }
  return found;
}
