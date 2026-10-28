export type RadioProvider = "radiolize" | "azuracast";

/** Switch embed stack: `radiolize` | `azuracast` */
export const RADIO_PROVIDER = "azuracast" as RadioProvider;

export const RADIO_PUBLIC_PAGE_URL =
  RADIO_PROVIDER === "radiolize"
    ? "https://my3.radiolize.com/public/estampas_andinas_intbtj"
    : "https://radio.estampasandinas.com/public/estampas_andinas";

/** Public AzuraCast endpoints used by the custom player on the home page. */
export const AZURACAST_BASE_URL = "https://radio.estampasandinas.com";
export const AZURACAST_STATION = "estampas_andinas";
export const NOW_PLAYING_URL = `${AZURACAST_BASE_URL}/api/nowplaying/${AZURACAST_STATION}`;
export const STREAM_URL = `${AZURACAST_BASE_URL}/listen/${AZURACAST_STATION}/radio.mp3`;
export const WHATSAPP_URL =
  "https://wa.me/51964624589?text=Hola%2C%20quisiera%20mandar%20un%20mensaje";

/** Public podcast list (recorded shows). Empty when there are no published podcasts. */
export const PODCASTS_URL = `${AZURACAST_BASE_URL}/api/station/${AZURACAST_STATION}/public/podcasts`;
