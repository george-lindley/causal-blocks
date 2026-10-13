// Every case study, in the order the picker shows them: easy, then medium, then hard. To add one:
// put its CSV in data/samples/, write a module like towns.js, list it here.
import tortoises from "./tortoises.js";
import chocolate from "./chocolate.js";
import cats from "./cats.js";
import beaches from "./beaches.js";
import snowman from "./snowman.js";
import towns from "./towns.js";
import chess from "./chess.js";
import pokemon from "./pokemon.js";
import coffee from "./coffee.js";
import cappuccino from "./cappuccino.js";
import mariokart from "./mariokart.js";
import penguins from "./penguins.js";

export const DATASETS = [
  tortoises, chocolate, cats, beaches, snowman,
  chess, pokemon, coffee, cappuccino,
  towns, mariokart, penguins,
];
