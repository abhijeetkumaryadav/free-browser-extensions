/* BleepBox bundled word list.
 * Mild: light words a "mild" filter catches.
 * Standard: common profanity most filters catch.
 * Strict: adds stronger slurs/profanity.
 * Users can add/remove words freely; this is only a starting list. */
'use strict';

const BUNDLED_WORDS = {
  mild: [
    'damn', 'hell', 'crap', 'piss', 'suck', 'sucks', 'sucky', 'shut up', 'stupid',
    'idiot', 'dumb', 'heck', 'freaking', 'fricking', 'frigging', 'geez', 'dang'
  ],
  standard: [
    'ass', 'asses', 'asshole', 'bastard', 'bitch', 'bitches', 'bitchy', 'boobs',
    'cock', 'cocks', 'dick', 'dicks', 'dildo', 'douche', 'douchebag', 'fag',
    'faggot', 'fuck', 'fucked', 'fucker', 'fucking', 'fucks', 'goddamn', 'horny',
    'jackass', 'jerkoff', 'nazi', 'nigga', 'pissed', 'prick', 'shit', 'shits',
    'shitty', 'slut', 'sluts', 'slutty', 'tits', 'titties', 'twat', 'wank',
    'wanker', 'whore', 'wtf'
  ],
  strict: [
    'cunt', 'motherfucker', 'motherfuckers', 'niggas', 'nigger', 'niggers',
    'porn', 'porno', 'rape', 'rapist', 'retard', 'retarded', 'semen', 'spic'
  ]
};

/** Words active for a given intensity: mild ⊆ standard ⊆ strict. */
function wordsForIntensity(intensity) {
  const mild = BUNDLED_WORDS.mild;
  const standard = BUNDLED_WORDS.standard;
  const strict = BUNDLED_WORDS.strict;
  if (intensity === 'mild') return mild;
  if (intensity === 'strict') return [...mild, ...standard, ...strict];
  return [...mild, ...standard];
}

if (typeof module !== 'undefined') module.exports = { BUNDLED_WORDS, wordsForIntensity };
