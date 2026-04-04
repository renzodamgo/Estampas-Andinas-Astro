export type RadioProvider = "radiolize" | "azuracast";

/** Switch embed stack: `radiolize` | `azuracast` */
export const RADIO_PROVIDER: RadioProvider = "radiolize";

export const RADIO_PUBLIC_PAGE_URL =
  RADIO_PROVIDER === "radiolize"
    ? "https://my3.radiolize.com/public/estampas_andinas_intbtj"
    : "https://radio.estampasandinas.com/public/estampas_andinas";
