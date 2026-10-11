// Stronger players and winning: Lichess games.
// Source: Lichess games via Kaggle (Mitchell J); via TidyTuesday 2024-10-01.
import { Kind } from "../data.js";

export default {
  key: "chess",
  file: "data/samples/chess.csv",
  tag: "Online chess",
  icon: "♟️",
  level: "medium",
  name: "Stronger players and winning",
  question: "Do stronger chess players win more often?",
  about: "4,000 games from Lichess, a free online chess site. Ratings measure strength and are shown in hundreds of points (15 means 1,500). We follow the player with the white pieces.",
  intro: [
    "On Lichess, a free online chess site, every player has a rating that measures their strength. <b>Do stronger players win more often?</b> We follow the player with the white pieces.",
  ],
  source: "Lichess games via Kaggle (Mitchell J)",
  tidytuesday: "2024-10-01",
  cause: "White rating",
  effect: "White wins",
  reads: "Each extra 100 rating points changes white's chance of winning by {est} (0.01 is 1 game in 100).",
  columns: {
    "White rating": { kind: Kind.NUMERIC },
    "White wins": { kind: Kind.BINARY, positive: "Win" },
    "Black rating": { kind: Kind.NUMERIC },
    "Rated game": { kind: Kind.BINARY, positive: "Rated" },
    "Rating gap": { kind: Kind.NUMERIC },
  },
  versions: [
    {
      name: "Our map",
      explain: "The site pairs players of similar strength, so a strong white player usually faces a strong opponent. Black's rating pushes on both, so it's frozen: white players are compared against equally strong opponents.",
      lesson: "Mr Confounder can hide an effect, not just fake one.",
      pos: { "White rating": [80, 215], "White wins": [556, 215], "Black rating": [318, 40] },
      edges: [["Black rating", "White rating"], ["Black rating", "White wins"], ["White rating", "White wins"]],
    },
    {
      name: "Just the correlation",
      mistake: true,
      explain: "Nothing frozen. Stronger white players also meet stronger opponents, which cancels out most of their advantage, so skill looks like it barely matters.",
      lesson: "When the system matches like with like, the plain comparison can hide a real effect.",
      pos: { "White rating": [190, 205], "White wins": [480, 205] },
      edges: [["White rating", "White wins"]],
    },
    {
      name: "Freeze rated or casual",
      fine: true,
      explain: "Rated and casual games pair players in the same way, so whether a game is rated doesn't push on white's rating. Freezing it leaves the answer where it was.",
      lesson: "Freezing something that doesn't push on the cause changes nothing.",
      pos: { "White rating": [80, 215], "White wins": [556, 215], "Black rating": [178, 40], "Rated game": [458, 40] },
      edges: [["Black rating", "White rating"], ["Black rating", "White wins"], ["Rated game", "White rating"], ["Rated game", "White wins"], ["White rating", "White wins"]],
    },
    {
      name: "Freeze the rating gap",
      mistake: true,
      explain: "The rating gap is white's rating minus black's. Freezing it compares games with the same gap, so a stronger white player must be facing an equally stronger opponent, and the effect vanishes.",
      lesson: "Never freeze something calculated from the cause.",
      pos: { "White rating": [80, 215], "White wins": [556, 215], "Rating gap": [318, 40] },
      edges: [["Rating gap", "White rating"], ["Rating gap", "White wins"], ["White rating", "White wins"]],
    },
  ],
};
