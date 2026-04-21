import type { Card } from '../types';

type CardViewProps = {
  card: Card;
  hidden?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
};

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

export function CardView({
  card,
  hidden = false,
  onClick,
  disabled = false,
  selected = false,
}: CardViewProps) {
  if (hidden) {
    return <div className="playing-card card-back" aria-hidden="true" />;
  }

  const suitClass = card.suit === 'diamonds' || card.suit === 'hearts' ? 'red' : 'black';

  return (
    <button
      type="button"
      className={`playing-card ${suitClass} ${selected ? 'selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={`${card.rank} de ${card.suit}`}
    >
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}
