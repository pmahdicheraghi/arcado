import { useEffect, useRef, useState } from 'react';
import { animateIn } from '../../app/animation';
import { useI18n } from '../../app/i18n';
import { triggerHaptic } from '../../app/settings';
import { playErrorSound, playPairSound, playTapSound } from '../../app/sfx';
import { recordMatchResult } from '../../app/stats';
import { getRoundStarter, type GameSetup, type Player } from '../../app/types';
import { GameHeader, GameStatus, MatchResultToast, ScoreStrip, Tip } from '../../components/react-layout';
import {
  chooseMemoryBotCard,
  createMemoryDeck,
  forgetCards,
  getAvailableCards,
  MEMORY_SYMBOLS,
  rememberCard,
  resolveMemoryPair,
  revealMemoryCard,
  type BotMemory,
  type MemoryCard,
} from './memory-match-logic';
import './memory-match.css';
import type { PlayerNames } from '../../app/player-names';

export function MemoryMatchPage({ setup, playerNames, onExit }: { setup: GameSetup; playerNames: PlayerNames; onExit: () => void }) {
  const { language, t } = useI18n();
  const mode = setup.mode;
  const [cards, setCards] = useState<MemoryCard[]>(createMemoryDeck);
  const [turn, setTurn] = useState<Player>('X');
  const [matchScores, setMatchScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [roundScores, setRoundScores] = useState<Record<Player, number>>({ X: 0, O: 0 });
  const [selected, setSelected] = useState<number[]>([]);
  const [lock, setLock] = useState(false);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [round, setRound] = useState(1);
  const pairTimeout = useRef<number | null>(null);
  const botMemory = useRef<BotMemory>(new Map());

  useEffect(() => animateIn('.score-strip, .memory-grid, .tip'), []);

  useEffect(
    () => () => {
      if (pairTimeout.current) window.clearTimeout(pairTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (mode !== 'bot' || turn !== 'O' || lock || selected.length > 1 || matchedPairs === MEMORY_SYMBOLS.length) return;
    const timeout = window.setTimeout(
      () => {
        const first = selected[0] ?? null;
        const available = getAvailableCards(cards).filter((index) => index !== first);
        if (!available.length) return;
        const choice = chooseMemoryBotCard(available, botMemory.current, setup.difficulty, first);
        const next = revealMemoryCard(cards, choice);
        botMemory.current = rememberCard(botMemory.current, choice, cards[choice].symbol);
        setCards(next);
        playTapSound();
        if (first === null) {
          setSelected([choice]);
        } else {
          setSelected([first, choice]);
          setLock(true);
          resolvePair(first, choice, next, false);
        }
      },
      selected.length ? 450 : 550,
    );
    return () => window.clearTimeout(timeout);
  }, [cards, mode, turn, lock, selected, matchedPairs, setup.difficulty]);

  const resetBoard = ({ keepScore = false, advanceRound = false } = {}) => {
    if (pairTimeout.current) window.clearTimeout(pairTimeout.current);
    const nextRound = advanceRound ? round + 1 : keepScore ? round : 1;
    setCards(createMemoryDeck());
    botMemory.current = new Map();
    setTurn(getRoundStarter(nextRound));
    if (!keepScore) setMatchScores({ X: 0, O: 0 });
    setRoundScores({ X: 0, O: 0 });
    setRound(nextRound);
    setSelected([]);
    setLock(false);
    setMatchedPairs(0);
  };

  const resolvePair = (first: number, second: number, currentCards: MemoryCard[], humanTurn: boolean) => {
    const matched = resolveMemoryPair(currentCards, first, second, turn).matched;
    pairTimeout.current = window.setTimeout(
      () => {
        if (matched) {
          playPairSound();
          setCards((current) => resolveMemoryPair(current, first, second, turn).cards);
          botMemory.current = forgetCards(botMemory.current, [first, second]);
          const nextPairs = matchedPairs + 1;
          const nextRoundScores = { ...roundScores, [turn]: roundScores[turn] + 1 };
          setRoundScores(nextRoundScores);
          setMatchedPairs(nextPairs);
          if (humanTurn) triggerHaptic([12, 25, 12]);

          if (nextPairs === MEMORY_SYMBOLS.length) {
            const roundWinner: Player | 'draw' =
              nextRoundScores.X === nextRoundScores.O ? 'draw' : nextRoundScores.X > nextRoundScores.O ? 'X' : 'O';
            const nextMatchScores = {
              ...matchScores,
              ...(roundWinner !== 'draw' ? { [roundWinner]: matchScores[roundWinner] + 1 } : {}),
            };
            if (roundWinner !== 'draw') {
              setMatchScores(nextMatchScores);
            }
            if (round >= setup.rounds) {
              const outcome = nextMatchScores.X === nextMatchScores.O ? 'draw' : nextMatchScores.X > nextMatchScores.O ? 'win' : 'loss';
              recordMatchResult('memory', outcome, { difficulty: mode === 'bot' ? setup.difficulty : undefined });
            }
          }
        } else {
          if (humanTurn) {
            playErrorSound();
            triggerHaptic(3);
          }
          setCards((current) => resolveMemoryPair(current, first, second, turn).cards);
          setTurn((current) => (current === 'X' ? 'O' : 'X'));
        }
        setSelected([]);
        setLock(false);
      },
      matched ? 420 : 900,
    );
  };

  useEffect(() => {
    if (matchedPairs !== MEMORY_SYMBOLS.length || round >= setup.rounds) return;
    const timeout = window.setTimeout(() => resetBoard({ keepScore: true, advanceRound: true }), 1600);
    return () => window.clearTimeout(timeout);
  }, [matchedPairs, round, setup.rounds]);

  const flip = (index: number) => {
    const card = cards[index];
    if (lock || card.flipped || card.matched || matchedPairs === MEMORY_SYMBOLS.length || (mode === 'bot' && turn === 'O')) return;
    const nextCards = revealMemoryCard(cards, index);
    const nextSelected = [...selected, index];
    if (mode === 'bot') botMemory.current = rememberCard(botMemory.current, index, card.symbol);
    setCards(nextCards);
    setSelected(nextSelected);
    triggerHaptic();
    playTapSound();
    if (nextSelected.length === 2) {
      setLock(true);
      resolvePair(nextSelected[0], nextSelected[1], nextCards, true);
    }
  };

  const finished = matchedPairs === MEMORY_SYMBOLS.length;
  const matchComplete = finished && round >= setup.rounds;
  const playerName = (player: Player) => playerNames[player];
  const status = finished
    ? matchComplete
      ? matchScores.X === matchScores.O
        ? t('matchDraw')
        : t('winsMatch', { player: playerName(matchScores.X > matchScores.O ? 'X' : 'O') })
      : t('deckComplete')
    : lock
      ? t('checkingPair')
      : t('flipTwo', { player: playerName(turn) });

  return (
    <main className="shell game-screen memory-screen theme-memory">
      <GameHeader
        title={t('memoryMatch')}
        statIcon="grid"
        statLabel={t('roundLabel')}
        statValue={new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(round)}
        statSuffix={<small>/ {new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(setup.rounds)}</small>}
        onExit={onExit}
      />
      <ScoreStrip
        leftLabel={playerNames.X}
        leftMark="✦"
        rightLabel={playerNames.O}
        rightMark="●"
        scores={matchScores}
        inGameScores={roundScores}
        inGameUnit={t('pairsUnit')}
        turn={turn}
      />
      <GameStatus>{status}</GameStatus>
      <section className="memory-grid" aria-label={t('memoryCards')}>
        {cards.map((card, index) => (
          <button
            type="button"
            className={`memory-card-tile ${card.flipped || card.matched ? 'is-flipped' : ''} ${card.matched ? `is-matched matched-${card.matchedBy?.toLowerCase()}` : ''}`}
            data-card-index={index}
            key={index}
            onClick={() => flip(index)}
            disabled={lock || card.flipped || card.matched || finished || (mode === 'bot' && turn === 'O')}
            aria-label={
              card.matched
                ? t('cardMatched', {
                    card: new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(index + 1),
                    symbol: card.symbol,
                  })
                : card.flipped
                  ? t('cardShown', {
                      card: new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(index + 1),
                      symbol: card.symbol,
                    })
                  : t('cardDown', { card: new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en').format(index + 1) })
            }
          >
            <span className="card-inner">
              <span className="card-face card-back">?</span>
              <span className="card-face card-front">{card.symbol}</span>
            </span>
          </button>
        ))}
      </section>
      <Tip>{t('memoryTip')}</Tip>
      {matchComplete && <MatchResultToast message={status} gameTitle={t('memoryMatch')} onExit={onExit} />}
    </main>
  );
}
