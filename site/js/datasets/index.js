// Every case study, in the order the picker shows them. To add one:
// put its CSV in data/samples/, write a module like towns.js, list it here.
import towns from "./towns.js";
import ielts from "./ielts.js";

export const DATASETS = [towns, ielts];
