export interface Hat {
  id: string;
  name: string;
  price: string;
  blurb: string;
  detail: string;
  /** CSS accent used by the shared hat drawing. */
  accent: string;
  brim: string;
}

export const HATS: Hat[] = [
  {
    id: "trucker",
    name: "Testnet Trucker",
    price: "24.00",
    blurb: "Foam front, mesh back, testnet gold.",
    detail: "A structured trucker for people who still read the block header. Mesh keeps the lab cool.",
    accent: "#d7a441",
    brim: "#0e1c33",
  },
  {
    id: "fedora",
    name: "Genesis Fedora",
    price: "86.00",
    blurb: "Pinched crown, wide brim, first-block felt.",
    detail: "The dress hat. A pinched crown and a ribbon the color of a coinbase.",
    accent: "#6b3f2a",
    brim: "#2a2118",
  },
  {
    id: "beanie",
    name: "Block Beanie",
    price: "18.00",
    blurb: "Ribbed knit for long confirmation nights.",
    detail: "Folded cuff, deep green, small enough to live in a jacket pocket.",
    accent: "#1f6b45",
    brim: "#143d28",
  },
  {
    id: "cap",
    name: "Satoshi Cap",
    price: "32.00",
    blurb: "Unstructured cap, curved brim, quiet logo.",
    detail: "Washed canvas and a brass eyelet. The everyday hat.",
    accent: "#1c1c1c",
    brim: "#111111",
  },
  {
    id: "bucket",
    name: "Miner Bucket",
    price: "28.00",
    blurb: "Downward brim, ochre cloth, full shade.",
    detail: "A bucket hat for pool operators and anyone else in the sun.",
    accent: "#c47b2b",
    brim: "#8d5a22",
  },
  {
    id: "panama",
    name: "Paymail Panama",
    price: "42.00",
    blurb: "Straw weave with a navy band.",
    detail: "Light, wide, and meant for a handle instead of a long address.",
    accent: "#e6d3a3",
    brim: "#cbb98a",
  },
];

export function hatById(id: string): Hat | undefined {
  return HATS.find((hat) => hat.id === id);
}

export function cartTotal(lines: Array<{ id: string; qty: number }>): { cents: number; fiatAmount: string } {
  let cents = 0;
  for (const line of lines) {
    const hat = hatById(line.id);
    if (!hat) continue;
    const [whole, frac] = hat.price.split(".");
    cents += (Number(whole) * 100 + Number(frac ?? "0")) * line.qty;
  }
  const fiatAmount = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  return { cents, fiatAmount };
}
